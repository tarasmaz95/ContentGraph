"""add pgvector extension and title_embedding column

Revision ID: 002
Revises: 001
Create Date: 2026-05-20

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

EMBED_DIM = 1536


def upgrade() -> None:
    # Enable pgvector in Postgres
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.add_column(
        "videos",
        sa.Column("title_embedding", Vector(EMBED_DIM), nullable=True),
    )

    # HNSW index for fast cosine similarity queries
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_videos_title_embedding_hnsw
        ON videos USING hnsw (title_embedding vector_cosine_ops)
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_videos_title_embedding_hnsw")
    op.drop_column("videos", "title_embedding")
