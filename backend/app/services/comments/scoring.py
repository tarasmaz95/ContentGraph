"""Comment ranking score — single source of truth.

The formula MUST stay in sync with:
- migration `021_comment_score.py` (backfill)
- extension content.js (`commentScore` in client-side ranking)

Tweak weights here, propagate to the migration and the extension constants.
"""

from __future__ import annotations

PINNED_BONUS = 1000
HEARTED_BONUS = 250
REPLY_WEIGHT = 2


def compute_comment_score(
    *,
    likes_count: int,
    reply_count: int,
    is_pinned: bool,
    is_hearted: bool,
) -> int:
    """Composite signal: engagement + creator endorsement.

    score = likes_count
          + reply_count * REPLY_WEIGHT
          + PINNED_BONUS if is_pinned
          + HEARTED_BONUS if is_hearted
    """
    return (
        int(likes_count or 0)
        + int(reply_count or 0) * REPLY_WEIGHT
        + (PINNED_BONUS if is_pinned else 0)
        + (HEARTED_BONUS if is_hearted else 0)
    )
