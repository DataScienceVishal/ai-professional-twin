from openai import AsyncOpenAI, AsyncAzureOpenAI


class EmbeddingService:
    def __init__(
        self,
        api_key: str,
        model: str,
        azure_endpoint: str | None = None,
        api_version: str | None = None,
        base_url: str | None = None,
    ) -> None:
        if azure_endpoint:
            self.client = AsyncAzureOpenAI(
                api_key=api_key,
                azure_endpoint=azure_endpoint,
                api_version=api_version or "2024-10-21",
            )
        else:
            self.client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        self.model = model

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        response = await self.client.embeddings.create(model=self.model, input=texts)
        return [item.embedding for item in response.data]

    async def embed_query(self, query: str) -> list[float]:
        result = await self.embed_texts([query])
        return result[0]
