"""SQLAlchemy declarative base shared by all models."""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Root metadata class for Alembic and model registration."""

    pass
