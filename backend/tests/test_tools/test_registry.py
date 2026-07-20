from app.tools import ToolRegistry
from app.tools.schemas import TOOL_DEFINITIONS


def test_registry_registers_tool() -> None:
    registry = ToolRegistry()

    async def dummy_tool(query: str) -> str:
        return f"result for {query}"

    registry.register("dummy", dummy_tool)
    assert "dummy" in registry.tools
    assert registry.tools["dummy"] is dummy_tool


def test_registry_get_tool() -> None:
    registry = ToolRegistry()

    async def dummy_tool(query: str) -> str:
        return f"result for {query}"

    registry.register("dummy", dummy_tool)
    tool = registry.get("dummy")
    assert tool is dummy_tool


def test_registry_get_unknown_returns_none() -> None:
    registry = ToolRegistry()
    assert registry.get("nonexistent") is None


def test_tool_definitions_are_valid() -> None:
    for defn in TOOL_DEFINITIONS:
        assert defn["type"] == "function"
        func = defn["function"]
        assert "name" in func
        assert "description" in func
        assert "parameters" in func
        assert func["parameters"]["type"] == "object"
