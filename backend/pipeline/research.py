"""Stage 4 — Research: retrieve relevant context from ChromaDB knowledge base."""

from __future__ import annotations

import logging

import chromadb
from chromadb.utils import embedding_functions

from backend.config import settings
from backend.models.types import ContextItem, PipelineState

logger = logging.getLogger(__name__)

_COLLECTION = "knowledge_base"
_TOP_K = 5


class ResearchStage:
    def __init__(self) -> None:
        self._client = chromadb.PersistentClient(path=settings.chroma_persist_directory)
        self._ef = embedding_functions.DefaultEmbeddingFunction()
        self._collection = self._client.get_or_create_collection(
            name=_COLLECTION,
            embedding_function=self._ef,
        )

    def run(self, state: PipelineState) -> PipelineState:
        assert state.parsed is not None, "parsed intent required"
        state.log("research: start")

        if self._collection.count() == 0:
            state.log("research: knowledge base empty — skipping retrieval")
            return state

        results = self._collection.query(
            query_texts=[state.parsed.intent],
            n_results=min(_TOP_K, self._collection.count()),
        )

        state.context = [
            ContextItem(
                source=meta.get("source", "unknown"),
                content=doc,
                relevance_score=1.0 - dist,  # chroma returns L2 distances
            )
            for doc, meta, dist in zip(
                results["documents"][0],
                results["metadatas"][0],
                results["distances"][0],
            )
        ]
        state.log(f"research: retrieved {len(state.context)} context items")
        return state

    def ingest(self, documents: list[dict]) -> None:
        """Populate the knowledge base. documents: [{"content": ..., "source": ...}]"""
        self._collection.add(
            documents=[d["content"] for d in documents],
            metadatas=[{"source": d["source"]} for d in documents],
            ids=[str(i) for i in range(len(documents))],
        )
        logger.info("Ingested %d documents into knowledge base", len(documents))
