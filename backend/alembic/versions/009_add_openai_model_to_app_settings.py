"""add openai_model to app_settings

Revision ID: 009
Revises: 008
Create Date: 2026-05-20

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "app_settings",
        sa.Column(
            "openai_model",
            sa.String(length=64),
            nullable=True,
            server_default="gpt-4o-mini",
        ),
    )


def downgrade() -> None:
    op.drop_column("app_settings", "openai_model")
