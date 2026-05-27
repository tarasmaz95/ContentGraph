"""comments structured metadata (reply_count, is_pinned, is_hearted, published_text)

Additive only — every existing row gets safe defaults:
- reply_count = 0
- is_pinned = false
- is_hearted = false
- published_text = NULL
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "020"
down_revision: Union[str, None] = "019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "comments",
        sa.Column(
            "reply_count",
            sa.BigInteger(),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "comments",
        sa.Column(
            "is_pinned",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "comments",
        sa.Column(
            "is_hearted",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "comments",
        sa.Column("published_text", sa.String(length=64), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("comments", "published_text")
    op.drop_column("comments", "is_hearted")
    op.drop_column("comments", "is_pinned")
    op.drop_column("comments", "reply_count")
