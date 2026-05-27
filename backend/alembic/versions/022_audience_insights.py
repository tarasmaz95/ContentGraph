"""audience_insights — cache table for generated audience intelligence

One row per video. Refresh strategy: lazy regeneration via API ?refresh=true,
no background jobs, no Kafka/Celery.

Columns:
- video_id        FK videos.id, UNIQUE — exactly one cached insight per video
- summary         TEXT — short audience-facing narrative
- top_topics      JSONB list of {label, weight}
- pain_points     JSONB list of strings
- desires         JSONB list of strings
- sentiment_distribution JSONB {positive, neutral, negative}
- top_comments_snapshot  JSONB list of mini-comments at generation time
- comment_count_at_generation INT — drives staleness UI
- model_used      VARCHAR(64) — which LLM produced the insight (or "rules")
- generated_at    TIMESTAMPTZ
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "022"
down_revision: Union[str, None] = "021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "audience_insights",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "video_id",
            sa.Integer(),
            sa.ForeignKey("videos.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("summary", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "top_topics",
            JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "pain_points",
            JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "desires",
            JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "sentiment_distribution",
            JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "top_comments_snapshot",
            JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "comment_count_at_generation",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "model_used",
            sa.String(length=64),
            nullable=False,
            server_default="rules",
        ),
        sa.Column(
            "generated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )


def downgrade() -> None:
    op.drop_table("audience_insights")
