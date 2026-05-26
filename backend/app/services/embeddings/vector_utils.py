"""Helpers for pgvector storage with async SQLAlchemy + asyncpg."""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


def to_vector_literal(embedding: list[float]) -> str:
    """
    Postgres pgvector text literal, e.g. '[0.1,0.2,...]'.

    Used with CAST(:vec AS vector) because ORM bulk flush may stringify lists.
    """
    return "[" + ",".join(str(v) for v in embedding) + "]"


async def save_video_embedding(
    db: AsyncSession,
    video_id: int,
    embedding: list[float],
    column: str,
) -> None:
    """
    Persist one embedding column via SQL literal ::vector.

    asyncpg cannot bind pgvector from a string parameter; numeric literals from
    OpenAI are inlined (safe — values are floats only). id stays parameterized.
    """
    allowed = {"title_embedding", "transcript_embedding"}
    if column not in allowed:
        raise ValueError(f"Invalid embedding column: {column}")

    literal = to_vector_literal(embedding)
    await db.execute(
        text(
            f"UPDATE videos SET {column} = '{literal}'::vector WHERE id = :id"
        ),
        {"id": video_id},
    )
