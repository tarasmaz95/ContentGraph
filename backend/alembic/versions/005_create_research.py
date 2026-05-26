"""create research_notes and saved_insights tables

Revision ID: 005
Revises: 004
Create Date: 2026-05-20

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "saved_insights",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("insight_text", sa.Text(), nullable=False),
        sa.Column("source_type", sa.String(length=64), nullable=False),
        sa.Column("source_reference", sa.String(length=512), server_default=""),
        sa.Column("tags", JSONB(), server_default="[]"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_saved_insights_source_type", "saved_insights", ["source_type"])

    op.create_table(
        "research_notes",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("type", sa.String(length=64), server_default="general"),
        sa.Column("creator_name", sa.String(length=255), nullable=True),
        sa.Column("tags", JSONB(), server_default="[]"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_research_notes_type", "research_notes", ["type"])
    op.create_index("ix_research_notes_creator_name", "research_notes", ["creator_name"])


def downgrade() -> None:
    op.drop_index("ix_research_notes_creator_name", table_name="research_notes")
    op.drop_index("ix_research_notes_type", table_name="research_notes")
    op.drop_table("research_notes")
    op.drop_index("ix_saved_insights_source_type", table_name="saved_insights")
    op.drop_table("saved_insights")
