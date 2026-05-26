"""Add sync mode (quick/full) to sync_runs."""

from alembic import op
import sqlalchemy as sa

revision = "016"
down_revision = "015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sync_runs",
        sa.Column("mode", sa.String(length=16), nullable=False, server_default="full"),
    )


def downgrade() -> None:
    op.drop_column("sync_runs", "mode")
