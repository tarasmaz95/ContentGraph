"""browser_ingestion_workers, runs, jobs."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "019"
down_revision = "018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "browser_ingestion_workers",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("token_hash", sa.String(length=128), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="offline"),
        sa.Column("current_action", sa.String(length=64), nullable=False, server_default="idle"),
        sa.Column("current_job_id", sa.Integer(), nullable=True),
        sa.Column("current_video_url", sa.String(length=512), nullable=True),
        sa.Column("last_heartbeat_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("stats_json", JSONB(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_browser_ingestion_workers_status", "browser_ingestion_workers", ["status"])

    op.create_table(
        "browser_ingestion_runs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="queued"),
        sa.Column("mode", sa.String(length=16), nullable=False, server_default="both"),
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
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_browser_ingestion_runs_status", "browser_ingestion_runs", ["status"])

    op.create_table(
        "browser_ingestion_jobs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("run_id", sa.Integer(), nullable=False),
        sa.Column("video_id", sa.Integer(), nullable=False),
        sa.Column("video_url", sa.String(length=512), nullable=False, server_default=""),
        sa.Column("title", sa.String(length=512), nullable=False, server_default=""),
        sa.Column("creator_name", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("mode", sa.String(length=16), nullable=False, server_default="both"),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="queued"),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_retries", sa.Integer(), nullable=False, server_default="2"),
        sa.Column("worker_id", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("result_json", JSONB(), nullable=True),
        sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["run_id"],
            ["browser_ingestion_runs.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(["video_id"], ["videos.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["worker_id"],
            ["browser_ingestion_workers.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_browser_ingestion_jobs_run_status",
        "browser_ingestion_jobs",
        ["run_id", "status"],
    )
    op.create_index("ix_browser_ingestion_jobs_video_id", "browser_ingestion_jobs", ["video_id"])


def downgrade() -> None:
    op.drop_index("ix_browser_ingestion_jobs_video_id", table_name="browser_ingestion_jobs")
    op.drop_index("ix_browser_ingestion_jobs_run_status", table_name="browser_ingestion_jobs")
    op.drop_table("browser_ingestion_jobs")
    op.drop_index("ix_browser_ingestion_runs_status", table_name="browser_ingestion_runs")
    op.drop_table("browser_ingestion_runs")
    op.drop_index("ix_browser_ingestion_workers_status", table_name="browser_ingestion_workers")
    op.drop_table("browser_ingestion_workers")
