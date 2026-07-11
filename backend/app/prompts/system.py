from app.prompts.templates import (
    BASE_IDENTITY,
    MODE_TEMPLATES,
    RESPONSE_RULES,
    ChatMode,
)


def build_system_prompt(mode: ChatMode, rag_context: str) -> str:
    parts = [BASE_IDENTITY, "", MODE_TEMPLATES[mode]]

    if rag_context.strip():
        parts.extend([
            "",
            "Use the following verified information to answer. Cite sources using "
            "[Source: X] notation. If the information below doesn't cover the question, "
            "say you don't have that information about Vishal.",
            "",
            "---",
            rag_context,
            "---",
        ])
    else:
        parts.extend([
            "",
            "No retrieved information is available for this query. Answer only based on "
            "your general knowledge about Vishal from the conversation context, or say you "
            "don't have that information.",
        ])

    parts.extend(["", RESPONSE_RULES])

    return "\n".join(parts)
