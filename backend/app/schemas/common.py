"""Shared chart/stat types — avoids circular imports between analytics and hooks."""

from pydantic import BaseModel, Field


class KeywordStat(BaseModel):
    keyword: str
    count: int
    avg_views: float = 0


class PatternStat(BaseModel):
    pattern: str
    count: int
    avg_views: float = 0


class HookTypeStat(BaseModel):
    hook_type: str
    count: int
    avg_views: float = 0


class ChartPoint(BaseModel):
    label: str
    value: float
    count: int = 0
