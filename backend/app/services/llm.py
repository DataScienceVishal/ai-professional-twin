import json
from collections.abc import AsyncGenerator
from typing import TYPE_CHECKING, Any, cast

from openai import AsyncOpenAI

from app.tools import ToolRegistry

if TYPE_CHECKING:
    from openai.types.chat import ChatCompletionMessageParam

MAX_TOOL_CALLS = 3
TOOL_RESULT_SUMMARY_LIMIT = 200


class LLMService:
    def __init__(self, api_key: str, base_url: str, model: str) -> None:
        self.client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        self.model = model

    async def chat(
        self,
        system_prompt: str,
        messages: list[dict[str, str]],
    ) -> str:
        all_messages = cast(
            "list[ChatCompletionMessageParam]",
            [{"role": "system", "content": system_prompt}, *messages],
        )
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=all_messages,
            temperature=0.3,
        )
        return response.choices[0].message.content or ""

    async def stream(
        self,
        system_prompt: str,
        messages: list[dict[str, str]],
    ) -> AsyncGenerator[str]:
        all_messages = cast(
            "list[ChatCompletionMessageParam]",
            [{"role": "system", "content": system_prompt}, *messages],
        )
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=all_messages,
            temperature=0.3,
            stream=True,
        )
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

        for _ in range(MAX_TOOL_CALLS + 1):
            create_kwargs: dict[str, Any] = {
                "model": self.model,
                "messages": all_messages,
                "temperature": 0.3,
                "stream": True,
            }
            if tool_definitions:
                create_kwargs["tools"] = tool_definitions

            response = await self.client.chat.completions.create(**create_kwargs)

            content_parts: list[str] = []
            tool_calls_acc: dict[int, dict[str, Any]] = {}
            finish_reason: str | None = None

            async for chunk in response:
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
