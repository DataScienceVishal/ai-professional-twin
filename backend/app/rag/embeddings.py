from openai import AsyncAzureOpenAI, AsyncOpenAI

# Keeps a full re-ingest from posting every document in one oversized request.
EMBED_BATCH_SIZE = 64


class EmbeddingService:
    def __init__(
        self,
        api_key: str,
        model: str,
        azure_endpoint: str | None = None,
        api_version: str | None = None,
        base_url: str | None = None,
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

    async def embed_texts(
        self, texts: list[str], batch_size: int = EMBED_BATCH_SIZE
    ) -> list[list[float]]:
        embeddings: list[list[float]] = []
        for start in range(0, len(texts), batch_size):
            batch = texts[start : start + batch_size]
            response = await self.client.embeddings.create(model=self.model, input=batch)
            embeddings.extend(item.embedding for item in response.data)
        return embeddings

    async def embed_query(self, query: str) -> list[float]:
        result = await self.embed_texts([query])
        return result[0]
