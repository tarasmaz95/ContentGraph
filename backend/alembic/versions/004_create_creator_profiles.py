"""create creator_profiles table

Revision ID: 004
Revises: 003
Create Date: 2026-05-20

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "creator_profiles",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("creator_name", sa.String(length=255), nullable=False),
        sa.Column("content_style", sa.Text(), nullable=False, server_default=""),
        sa.Column("top_topics", JSONB(), nullable=False, server_default="[]"),
        sa.Column("hook_patterns", JSONB(), nullable=False, server_default="[]"),
        sa.Column("communication_style", sa.Text(), nullable=False, server_default=""),
        sa.Column("emotional_triggers", JSONB(), nullable=False, server_default="[]"),
        sa.Column("audience_type", sa.Text(), nullable=False, server_default=""),
        sa.Column("creator_summary", sa.Text(), nullable=False, server_default=""),
        sa.Column("avg_views", sa.Float(), nullable=False, server_default="0"),
        sa.Column("total_videos", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_views", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_creator_profiles_creator_name", "creator_profiles", ["creator_name"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_creator_profiles_creator_name", table_name="creator_profiles")
    op.drop_table("creator_profiles")
