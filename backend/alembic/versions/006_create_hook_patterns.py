"""hook_patterns table for Hook Intelligence System"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "hook_patterns",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("video_id", sa.Integer(), nullable=True),
        sa.Column("hook_text", sa.Text(), nullable=False),
        sa.Column("hook_type", sa.String(length=64), nullable=False),
        sa.Column("creator_name", sa.String(length=255), nullable=False),
        sa.Column("views_count", sa.BigInteger(), nullable=True),
        sa.Column("video_title", sa.Text(), nullable=False),
        sa.Column("effectiveness_score", sa.Float(), nullable=True),
        sa.Column("confidence_score", sa.Float(), nullable=True),
        sa.Column("keywords", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("emotional_triggers", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["video_id"], ["videos.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_hook_patterns_hook_type", "hook_patterns", ["hook_type"])
    op.create_index("ix_hook_patterns_creator_name", "hook_patterns", ["creator_name"])
    op.create_index("ix_hook_patterns_video_id", "hook_patterns", ["video_id"])


def downgrade() -> None:
    op.drop_index("ix_hook_patterns_video_id", table_name="hook_patterns")
    op.drop_index("ix_hook_patterns_creator_name", table_name="hook_patterns")
    op.drop_index("ix_hook_patterns_hook_type", table_name="hook_patterns")
    op.drop_table("hook_patterns")
