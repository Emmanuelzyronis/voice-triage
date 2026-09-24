"""Stage 4 — Research: retrieve relevant context from ChromaDB knowledge base."""

from __future__ import annotations

import logging

import chromadb
from chromadb.utils import embedding_functions

from backend.config import settings
from backend.models.types import ContextItem, PipelineState

logger = logging.getLogger(__name__)

_TOP_K = 5
_RELEVANCE_THRESHOLD = 0.5


class ResearchStage:
    def __init__(self) -> None:
        self._client = chromadb.PersistentClient(path=settings.chroma_persist_directory)
        self._ef = embedding_functions.DefaultEmbeddingFunction()

    def _get_collection(self, tenant_id: str) -> chromadb.Collection:
        name = f"{tenant_id}_knowledge_base" if tenant_id else "knowledge_base"
        return self._client.get_or_create_collection(name=name, embedding_function=self._ef)

    def run(self, state: PipelineState) -> PipelineState:
        assert state.parsed is not None, "parsed intent required"
        state.log("research: start")

        collection = self._get_collection(state.tenant_id)
        if collection.count() == 0:
            state.log("research: knowledge base empty — skipping retrieval")
            return state

        results = collection.query(
            query_texts=[state.parsed.intent],
            n_results=min(_TOP_K, collection.count()),
        )

        items: list[ContextItem] = []
        for doc, meta, dist in zip(
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0],
        ):
            # L2 distances for normalized embeddings are in [0, 2]; map to [0, 1]
            score = max(0.0, 1.0 - (dist / 2.0))
            if score < _RELEVANCE_THRESHOLD:
                continue
            items.append(ContextItem(
                source=meta.get("source", "unknown"),
                content=doc,
                relevance_score=score,
            ))

        dropped = len(results["documents"][0]) - len(items)
        state.context = items
        state.log(f"research: {len(items)} items kept, {dropped} below threshold={_RELEVANCE_THRESHOLD}")
        return state

    def ingest(self, documents: list[dict], tenant_id: str = "") -> None:
        """Populate the knowledge base. documents: [{"content": ..., "source": ...}]"""
        collection = self._get_collection(tenant_id)
        start = collection.count()
        collection.add(
            documents=[d["content"] for d in documents],
            metadatas=[{"source": d["source"]} for d in documents],
            ids=[str(start + i) for i in range(len(documents))],
        )
        logger.info("Ingested %d documents into %s", len(documents), collection.name)
