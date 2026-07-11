from openai import AsyncOpenAI


class EmbeddingService:
    def __init__(self, api_key: str, base_url: str, model: str) -> None:
        self.client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        self.model = model

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        response = await self.client.embeddings.create(model=self.model, input=texts)
        return [item.embedding for item in response.data]

    async def embed_query(self, query: str) -> list[float]:
        result = await self.embed_texts([query])
        return result[0]
