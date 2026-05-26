"""add transcript and transcript_embedding

Revision ID: 003
Revises: 002
Create Date: 2026-05-20

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

EMBED_DIM = 1536


def upgrade() -> None:
    op.add_column("videos", sa.Column("transcript", sa.Text(), nullable=True))
    op.add_column(
        "videos",
        sa.Column("transcript_embedding", Vector(EMBED_DIM), nullable=True),
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_videos_transcript_embedding_hnsw
        ON videos USING hnsw (transcript_embedding vector_cosine_ops)
        WHERE transcript_embedding IS NOT NULL
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_videos_transcript_embedding_hnsw")
    op.drop_column("videos", "transcript_embedding")
    op.drop_column("videos", "transcript")
