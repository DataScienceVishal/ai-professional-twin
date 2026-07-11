from pydantic import BaseModel, Field

from app.prompts.templates import ChatMode


class Message(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(max_length=2000)


class ChatRequest(BaseModel):
    messages: list[Message] = Field(min_length=1, max_length=50)
    mode: ChatMode = ChatMode.DEFAULT
