"""comment_score — persisted ranking signal for audience intelligence

Additive only. Adds:
- `comment_score BIGINT NOT NULL DEFAULT 0` on `comments`
- index `(video_id, comment_score DESC)` for fast top-N queries
- backfill from existing structured columns

Formula:
    score = likes_count
          + (reply_count * 2)
          + (is_pinned ? 1000 : 0)
          + (is_hearted ? 250 : 0)

Pre-existing rows that lack reply/pinned/hearted simply score `likes_count`.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "021"
down_revision: Union[str, None] = "020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "comments",
        sa.Column(
            "comment_score",
            sa.BigInteger(),
            nullable=False,
            server_default="0",
        ),
    )

    # Backfill score for existing rows using the same formula as the runtime
    # ingest path. Safe to run on a hot DB — single UPDATE, no row-by-row.
    op.execute(
        """
        UPDATE comments
           SET comment_score = COALESCE(likes_count, 0)
                             + COALESCE(reply_count, 0) * 2
                             + CASE WHEN is_pinned THEN 1000 ELSE 0 END
                             + CASE WHEN is_hearted THEN 250 ELSE 0 END
        """
    )

    op.create_index(
        "ix_comments_video_score",
        "comments",
        ["video_id", sa.text("comment_score DESC")],
    )


def downgrade() -> None:
    op.drop_index("ix_comments_video_score", table_name="comments")
    op.drop_column("comments", "comment_score")
