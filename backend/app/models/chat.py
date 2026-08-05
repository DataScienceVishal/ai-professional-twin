from pydantic import BaseModel, Field, model_validator

from app.prompts.templates import ChatMode

# Longest a single message may be, per role.
#
# A `user` turn is typed into the input box, so 2000 characters is already far
# more than anyone asks and it keeps a pasted wall of text out of the prompt.
#
# An `assistant` turn is not input at all: it is an answer this server
# generated on an earlier request, which the client replays so the model can
# follow up on what it just said. Its length is bounded by
# `llm_max_output_tokens` (1024 by default - comfortably more than 2000
# characters), so holding it to the user limit rejected the server's own output
# and made the second turn of every conversation fail with a 422. The assistant
# limit exists only to stop a forged history from ballooning the prompt, so it
# sits well clear of any real answer.
MAX_CONTENT_CHARS = {"user": 2000, "assistant": 16000}


class Message(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str

    @model_validator(mode="after")
    def _limit_content_by_role(self) -> "Message":
        # `role` is pattern-checked at field level, which runs first, so the
        # lookup cannot miss.
        limit = MAX_CONTENT_CHARS[self.role]
        if len(self.content) > limit:
            raise ValueError(f"{self.role} message content must be at most {limit} characters")
        return self


class ChatRequest(BaseModel):
    messages: list[Message] = Field(min_length=1, max_length=50)
    mode: ChatMode = ChatMode.DEFAULT
