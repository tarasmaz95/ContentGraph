"""snapshot_runs — lightweight cron/manual run log."""

from alembic import op
import sqlalchemy as sa

revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "snapshot_runs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("creators_saved", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("videos_saved", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("source", sa.String(length=16), nullable=False, server_default="manual"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_snapshot_runs_started_at", "snapshot_runs", ["started_at"])
    op.create_index("ix_snapshot_runs_status", "snapshot_runs", ["status"])


def downgrade() -> None:
    op.drop_index("ix_snapshot_runs_status", table_name="snapshot_runs")
    op.drop_index("ix_snapshot_runs_started_at", table_name="snapshot_runs")
    op.drop_table("snapshot_runs")
