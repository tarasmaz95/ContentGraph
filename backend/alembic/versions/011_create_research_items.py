"""research_collections and research_items — snapshot research workspace

Revision ID: 011
Revises: 010
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "011"
down_revision: Union[str, None] = "010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "research_collections",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "research_items",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("collection_id", sa.Integer(), nullable=True),
        sa.Column("type", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=512), nullable=False),
        sa.Column("payload_json", JSONB(), nullable=False, server_default="{}"),
        sa.Column("notes", sa.Text(), server_default=""),
        sa.Column("tags", JSONB(), server_default="[]"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["collection_id"],
            ["research_collections.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_research_items_type", "research_items", ["type"])
    op.create_index("ix_research_items_collection_id", "research_items", ["collection_id"])
    op.create_index("ix_research_items_created_at", "research_items", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_research_items_created_at", table_name="research_items")
    op.drop_index("ix_research_items_collection_id", table_name="research_items")
    op.drop_index("ix_research_items_type", table_name="research_items")
    op.drop_table("research_items")
    op.drop_table("research_collections")
