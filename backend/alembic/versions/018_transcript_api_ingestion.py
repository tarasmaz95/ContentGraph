"""transcript_api_ingestion_runs + transcript_api_ingestion_jobs."""

from alembic import op
import sqlalchemy as sa

revision = "018"
down_revision = "017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "transcript_api_ingestion_runs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="queued"),
        sa.Column("worker_count", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("limit_count", sa.Integer(), nullable=True),
        sa.Column("creator_filter", sa.String(length=255), nullable=True),
        sa.Column("latest_only", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("only_missing", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("jobs_total", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("message", sa.String(length=512), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_transcript_api_ingestion_runs_status",
        "transcript_api_ingestion_runs",
        ["status"],
    )

    op.create_table(
        "transcript_api_ingestion_jobs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("run_id", sa.Integer(), nullable=False),
        sa.Column("video_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="queued"),
        sa.Column("title", sa.String(length=512), nullable=False, server_default=""),
        sa.Column("creator_name", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("transcript_chars", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("embedding_created", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("sheets_rows_updated", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sheets_writeback", sa.String(length=16), nullable=False, server_default="skipped"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["run_id"],
            ["transcript_api_ingestion_runs.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(["video_id"], ["videos.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_transcript_api_ingestion_jobs_run_status",
        "transcript_api_ingestion_jobs",
        ["run_id", "status"],
    )
    op.create_index(
        "ix_transcript_api_ingestion_jobs_video_id",
        "transcript_api_ingestion_jobs",
        ["video_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_transcript_api_ingestion_jobs_video_id", table_name="transcript_api_ingestion_jobs")
    op.drop_index("ix_transcript_api_ingestion_jobs_run_status", table_name="transcript_api_ingestion_jobs")
    op.drop_table("transcript_api_ingestion_jobs")
    op.drop_index("ix_transcript_api_ingestion_runs_status", table_name="transcript_api_ingestion_runs")
    op.drop_table("transcript_api_ingestion_runs")
