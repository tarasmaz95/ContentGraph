"""creator_stats_history and video_stats_history tables"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "010"
down_revision: Union[str, None] = "009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "creator_stats_history",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("creator_name", sa.String(length=255), nullable=False),
        sa.Column("youtube_channel_id", sa.String(length=128), nullable=True),
        sa.Column("subscribers_count", sa.BigInteger(), nullable=True),
        sa.Column("total_views", sa.BigInteger(), nullable=True),
        sa.Column("total_videos", sa.Integer(), nullable=True),
        sa.Column("snapshot_date", sa.Date(), nullable=False),
        sa.Column(
            "captured_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("creator_name", "snapshot_date", name="uq_creator_stats_day"),
    )
    op.create_index(
        "ix_creator_stats_history_creator_name",
        "creator_stats_history",
        ["creator_name"],
    )
    op.create_index(
        "ix_creator_stats_history_snapshot_date",
        "creator_stats_history",
        ["snapshot_date"],
    )

    op.create_table(
        "video_stats_history",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("video_id", sa.Integer(), nullable=False),
        sa.Column("views_count", sa.BigInteger(), nullable=True),
        sa.Column("likes_count", sa.BigInteger(), nullable=True),
        sa.Column("comments_count", sa.Integer(), nullable=True),
        sa.Column("snapshot_date", sa.Date(), nullable=False),
        sa.Column(
            "captured_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["video_id"], ["videos.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("video_id", "snapshot_date", name="uq_video_stats_day"),
    )
    op.create_index(
        "ix_video_stats_history_video_id",
        "video_stats_history",
        ["video_id"],
    )
    op.create_index(
        "ix_video_stats_history_snapshot_date",
        "video_stats_history",
        ["snapshot_date"],
    )


def downgrade() -> None:
    op.drop_index("ix_video_stats_history_snapshot_date", table_name="video_stats_history")
    op.drop_index("ix_video_stats_history_video_id", table_name="video_stats_history")
    op.drop_table("video_stats_history")
    op.drop_index("ix_creator_stats_history_snapshot_date", table_name="creator_stats_history")
    op.drop_index("ix_creator_stats_history_creator_name", table_name="creator_stats_history")
    op.drop_table("creator_stats_history")
