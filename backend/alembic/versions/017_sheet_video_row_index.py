"""sheet_video_row_index — YouTube video_id to Google Sheets row numbers."""

from alembic import op
import sqlalchemy as sa

revision = "017"
down_revision = "016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sheet_video_row_index",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("spreadsheet_id", sa.String(length=128), nullable=False),
        sa.Column("youtube_video_id", sa.String(length=11), nullable=False),
        sa.Column("sheet_row_number", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "spreadsheet_id",
            "youtube_video_id",
            "sheet_row_number",
            name="uq_sheet_video_row",
        ),
    )
    op.create_index(
        "ix_sheet_video_row_lookup",
        "sheet_video_row_index",
        ["spreadsheet_id", "youtube_video_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_sheet_video_row_lookup", table_name="sheet_video_row_index")
    op.drop_table("sheet_video_row_index")
