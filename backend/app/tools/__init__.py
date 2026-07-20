from collections.abc import Callable, Coroutine
from typing import Any


class ToolRegistry:
    def __init__(self) -> None:
        self.tools: dict[str, Callable[..., Coroutine[Any, Any, str]]] = {}

    def register(self, name: str, func: Callable[..., Coroutine[Any, Any, str]]) -> None:
        self.tools[name] = func

    def get(self, name: str) -> Callable[..., Coroutine[Any, Any, str]] | None:
        return self.tools.get(name)

    async def execute(self, name: str, arguments: dict[str, Any]) -> str:
        tool = self.tools.get(name)
        if not tool:
            return f"Unknown tool: {name}"
        try:
            return await tool(**arguments)
        except Exception as e:
            return f"Tool error: {e}"
