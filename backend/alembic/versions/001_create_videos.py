"""create videos table

Revision ID: 001
Revises:
Create Date: 2026-05-20

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "videos",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("creator_name", sa.String(length=255), nullable=False),
        sa.Column("channel_url", sa.String(length=512), nullable=False),
        sa.Column("subscribers_count", sa.BigInteger(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("views_count", sa.BigInteger(), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_videos_creator_name", "videos", ["creator_name"])
    op.create_index("ix_videos_views_count", "videos", ["views_count"])


def downgrade() -> None:
    op.drop_index("ix_videos_views_count", table_name="videos")
    op.drop_index("ix_videos_creator_name", table_name="videos")
    op.drop_table("videos")
