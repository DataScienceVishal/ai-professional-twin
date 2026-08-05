import json

import pytest

from app.tools.action_tools import create_action_tools


@pytest.mark.asyncio
async def test_get_resume_download_link() -> None:
    tools = create_action_tools(api_base_url="https://api.example.com")
    result = await tools["get_resume_download_link"]()
    parsed = json.loads(result)
    assert "url" in parsed
    assert "resume/download" in parsed["url"]


@pytest.mark.asyncio
async def test_resume_link_points_at_the_given_api_base() -> None:
    tools = create_action_tools(api_base_url="https://api.up.railway.app")
    parsed = json.loads(await tools["get_resume_download_link"]())
    assert parsed["url"] == "https://api.up.railway.app/resume/download"


@pytest.mark.asyncio
async def test_resume_link_handles_a_trailing_slash() -> None:
    tools = create_action_tools(api_base_url="https://api.example.com/")
    parsed = json.loads(await tools["get_resume_download_link"]())
    assert parsed["url"] == "https://api.example.com/resume/download"


@pytest.mark.asyncio
async def test_generate_comparison_table() -> None:
    tools = create_action_tools(api_base_url="https://api.example.com")
    result = await tools["generate_comparison_table"](
        items=["Python", "JavaScript"],
        criteria=["Type System", "Performance"],
    )
    assert "Python" in result
    assert "JavaScript" in result
    assert "Type System" in result
    assert "|" in result
