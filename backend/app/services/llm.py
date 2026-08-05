import json
from collections.abc import AsyncGenerator
from typing import TYPE_CHECKING, Any, cast

from openai import AsyncAzureOpenAI, AsyncOpenAI

from app.tools import ToolRegistry

if TYPE_CHECKING:
    from openai import AsyncStream
    from openai.types.chat import ChatCompletionChunk, ChatCompletionMessageParam

MAX_TOOL_CALLS = 3
TOOL_RESULT_SUMMARY_LIMIT = 200

# GPT-5 and the o-series reasoning models only accept the default temperature on
# Chat Completions (anything else is an HTTP 400) and take the output cap as
# `max_completion_tokens` rather than `max_tokens`.
GPT5_FAMILY_PREFIXES = ("gpt-5", "o1", "o3", "o4")

# Reasoning tokens are billed as output and are spent before the first visible
# token, so effort drives both cost and time-to-first-token. Answering from
# retrieved context needs very little deliberation, so this deployment runs low.
# Set to "" to omit the parameter and let the service default apply.
VALID_REASONING_EFFORTS = ("minimal", "low", "medium", "high")


def is_gpt5_family(model: str) -> bool:
    return model.lower().startswith(GPT5_FAMILY_PREFIXES)


class LLMService:
    def __init__(
        self,
        api_key: str,
        model: str,
        azure_endpoint: str | None = None,
        api_version: str | None = None,
        base_url: str | None = None,
        temperature: float = 0.3,
        max_output_tokens: int = 0,
        send_temperature: bool | None = None,
        stream_usage: bool = False,
        reasoning_effort: str = "",
    ) -> None:
        self.client: AsyncOpenAI
        if azure_endpoint:
            self.client = AsyncAzureOpenAI(
                api_key=api_key,
                azure_endpoint=azure_endpoint,
                api_version=api_version or "2024-10-21",
            )
        else:
            self.client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        self.model = model
        self.temperature = temperature
        self.max_output_tokens = max_output_tokens
        self.stream_usage = stream_usage
        self.is_gpt5 = is_gpt5_family(model)
        # An explicit setting always wins over the model-name heuristic.
        self.send_temperature = (not self.is_gpt5) if send_temperature is None else send_temperature
        # Only reasoning models accept the parameter; a GPT-4 deployment would
        # reject it. An unrecognised value is dropped rather than sent, so a
        # typo in an env var degrades to the service default instead of 400ing
        # every request in production.
        effort = reasoning_effort.strip().lower()
        self.reasoning_effort = effort if effort in VALID_REASONING_EFFORTS else ""

    def build_completion_kwargs(
        self,
        messages: list[Any],
        *,
        stream: bool,
        tools: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        kwargs: dict[str, Any] = {"model": self.model, "messages": messages}
        if self.send_temperature:
            kwargs["temperature"] = self.temperature
        if self.max_output_tokens > 0:
            key = "max_completion_tokens" if self.is_gpt5 else "max_tokens"
            kwargs[key] = self.max_output_tokens
        if self.is_gpt5 and self.reasoning_effort:
            kwargs["reasoning_effort"] = self.reasoning_effort
        if stream:
            kwargs["stream"] = True
            if self.stream_usage:
                kwargs["stream_options"] = {"include_usage": True}
        if tools:
            kwargs["tools"] = tools
        return kwargs

    async def stream(
        self,
        system_prompt: str,
        messages: list[dict[str, str]],
    ) -> AsyncGenerator[str]:
        all_messages = cast(
            "list[ChatCompletionMessageParam]",
            [{"role": "system", "content": system_prompt}, *messages],
        )
        raw = await self.client.chat.completions.create(
            **self.build_completion_kwargs(list(all_messages), stream=True)
        )
        response = cast("AsyncStream[ChatCompletionChunk]", raw)
        async for chunk in response:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    async def stream_with_tools(
        self,
        system_prompt: str,
        messages: list[dict[str, str]],
        tool_definitions: list[dict[str, Any]],
        tool_registry: ToolRegistry,
    ) -> AsyncGenerator[dict[str, Any]]:
        all_messages: list[dict[str, Any]] = [
            {"role": "system", "content": system_prompt},
            *messages,
        ]
        usage_totals: dict[str, int] = {}

        for _ in range(MAX_TOOL_CALLS + 1):
            raw = await self.client.chat.completions.create(
                **self.build_completion_kwargs(
                    all_messages, stream=True, tools=tool_definitions or None
                )
            )
            response = cast("AsyncStream[ChatCompletionChunk]", raw)

            content_parts: list[str] = []
            tool_calls_acc: dict[int, dict[str, Any]] = {}
            finish_reason: str | None = None

            async for chunk in response:
                _accumulate_usage(usage_totals, chunk)

                if not chunk.choices:
                    continue
                choice = chunk.choices[0]
                delta = choice.delta

                if choice.finish_reason:
                    finish_reason = choice.finish_reason

                if delta.content:
                    content_parts.append(delta.content)
                    yield {"type": "chunk", "content": delta.content}

                if delta.tool_calls:
                    for tc in delta.tool_calls:
                        index = tc.index
                        if index not in tool_calls_acc:
                            tool_calls_acc[index] = {
                                "id": "",
                                "name": "",
                                "arguments": "",
                            }
                        entry = tool_calls_acc[index]
                        if tc.id:
                            entry["id"] = tc.id
                        if tc.function:
                            if tc.function.name:
                                entry["name"] += tc.function.name
                            if tc.function.arguments:
                                entry["arguments"] += tc.function.arguments

            if finish_reason == "tool_calls" and tool_calls_acc:
                assistant_tool_calls = []
                for index in sorted(tool_calls_acc.keys()):
                    entry = tool_calls_acc[index]
                    assistant_tool_calls.append(
                        {
                            "id": entry["id"],
                            "type": "function",
                            "function": {
                                "name": entry["name"],
                                "arguments": entry["arguments"],
                            },
                        }
                    )

                all_messages.append(
                    {
                        "role": "assistant",
                        "content": "".join(content_parts) or None,
                        "tool_calls": assistant_tool_calls,
                    }
                )

                for entry in assistant_tool_calls:
                    name = entry["function"]["name"]
                    raw_arguments = entry["function"]["arguments"]
                    try:
                        arguments = json.loads(raw_arguments) if raw_arguments else {}
                    except json.JSONDecodeError:
                        arguments = {}

                    yield {"type": "tool_start", "tool": name, "args": arguments}

                    result = await tool_registry.execute(name, arguments)
                    summary = result[:TOOL_RESULT_SUMMARY_LIMIT]

                    yield {"type": "tool_result", "tool": name, "summary": summary}

                    all_messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": entry["id"],
                            "content": result,
                        }
                    )

                continue

            break

        if usage_totals:
            # Consumed by the chat router for cost logging; not forwarded to the
            # browser.
            yield {"type": "usage", **usage_totals}


def _accumulate_usage(totals: dict[str, int], chunk: Any) -> None:
    """Fold a chunk's usage block into the running totals, if it carries one."""
    usage = getattr(chunk, "usage", None)
    if usage is None:
        return
    for field in ("prompt_tokens", "completion_tokens", "total_tokens"):
        value = getattr(usage, field, None)
        if isinstance(value, int):
            totals[field] = totals.get(field, 0) + value
