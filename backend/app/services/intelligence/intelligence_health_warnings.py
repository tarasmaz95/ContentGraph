"""Deterministic warnings for intelligence health — no LLM."""

from __future__ import annotations

from app.schemas.intelligence_health import (
    CommentHealthSection,
    HealthWarning,
    IntelligenceOverview,
    SnapshotHealthSection,
    TranscriptHealthSection,
)


def build_health_warnings(
    overview: IntelligenceOverview,
    transcripts: TranscriptHealthSection,
    comments: CommentHealthSection,
    snapshots: SnapshotHealthSection,
    *,
    hook_patterns_eligible: int,
    videos_with_view_delta: int,
) -> list[HealthWarning]:
    warnings: list[HealthWarning] = []
    total = overview.total_videos or 1

    tpct = overview.transcript_coverage_pct
    if tpct < 0.5:
        warnings.append(
            HealthWarning(
                id="transcript-coverage-critical",
                severity="critical",
                message=f"Only {tpct:.2f}% of videos have transcripts",
                detail=(
                    f"{overview.videos_with_transcripts:,} of {overview.total_videos:,} "
                    "videos — semantic search and transcript intelligence are severely limited."
                ),
            )
        )
    elif tpct < 5.0:
        warnings.append(
            HealthWarning(
                id="transcript-coverage-low",
                severity="warning",
                message=f"Transcript coverage is {tpct:.1f}%",
                detail="Most videos lack transcripts — use the Chrome extension or batch ingest.",
            )
        )

    cpct = overview.comment_coverage_pct
    if cpct < 0.1:
        warnings.append(
            HealthWarning(
                id="comment-coverage-critical",
                severity="critical",
                message=f"Comment coverage is {cpct:.2f}%",
                detail="Audience intelligence in /feed depends on synced comments.",
            )
        )
    elif cpct < 1.0:
        warnings.append(
            HealthWarning(
                id="comment-coverage-low",
                severity="warning",
                message=f"Only {cpct:.1f}% of videos have synced comments",
                detail=f"{comments.total_comments:,} comments across {comments.videos_with_comments} videos.",
            )
        )

    if comments.top_video_comment_share_pct >= 50 and comments.total_comments >= 10:
        warnings.append(
            HealthWarning(
                id="comments-concentrated",
                severity="warning",
                message="Audience intelligence is concentrated in few videos",
                detail=(
                    f"{comments.top_video_comment_share_pct:.0f}% of comments sit on one video — "
                    "/feed audience themes may not represent the catalog."
                ),
            )
        )

    epct = overview.embedding_coverage_pct
    if epct < 1.0 and overview.videos_with_transcripts > 0:
        warnings.append(
            HealthWarning(
                id="embedding-gap",
                severity="warning",
                message=f"Embedding coverage is {epct:.1f}%",
                detail=(
                    f"{transcripts.transcripts_missing_embeddings} transcripts lack embeddings — "
                    "check OpenAI configuration."
                ),
            )
        )

    if snapshots.snapshot_days < 2:
        warnings.append(
            HealthWarning(
                id="snapshot-history-none",
                severity="critical",
                message="No snapshot history for momentum",
                detail="Run daily snapshots at least twice before breakout signals are possible.",
            )
        )
    elif snapshots.snapshot_days < 7:
        warnings.append(
            HealthWarning(
                id="snapshot-history-short",
                severity="info",
                message="Snapshot history is short for reliable 7d momentum",
                detail=(
                    f"{snapshots.snapshot_days} distinct snapshot day(s) — "
                    "breakout labels use earliest snapshot until 7+ days exist."
                ),
            )
        )

    if snapshots.snapshot_days >= 2 and videos_with_view_delta == 0:
        warnings.append(
            HealthWarning(
                id="momentum-flat",
                severity="warning",
                message="No breakout signals — views unchanged between snapshots",
                detail=(
                    "Snapshots are running but views_count did not change — "
                    "re-sync Sheets after YouTube view updates."
                ),
            )
        )
    elif videos_with_view_delta > 0:
        warnings.append(
            HealthWarning(
                id="momentum-active",
                severity="info",
                message="Momentum layer can compute view deltas",
                detail=f"{videos_with_view_delta:,} videos show different views across snapshot days.",
            )
        )

    if hook_patterns_eligible > 0:
        warnings.append(
            HealthWarning(
                id="hooks-active",
                severity="info",
                message="Hook pattern intelligence is active",
                detail=f"{hook_patterns_eligible} hook type(s) pass underused + outperform rules for /feed.",
            )
        )
    else:
        warnings.append(
            HealthWarning(
                id="hooks-inactive",
                severity="info",
                message="No underused hook patterns qualify for /feed today",
                detail="Hook index exists but median-usage filter may exclude all types.",
            )
        )

    if transcripts.transcripts_missing_embeddings > 0:
        warnings.append(
            HealthWarning(
                id="transcript-embed-missing",
                severity="warning",
                message=f"{transcripts.transcripts_missing_embeddings} transcripts missing embeddings",
                detail="Transcript text exists but transcript_embedding is null.",
            )
        )

    last_run = snapshots.recent_runs[0] if snapshots.recent_runs else None
    if last_run and last_run.status == "failed":
        warnings.append(
            HealthWarning(
                id="snapshot-failed",
                severity="critical",
                message="Latest snapshot run failed",
                detail=last_run.error_message or "Check Settings or server logs.",
            )
        )

    return warnings


def build_system_status(
    warnings: list[HealthWarning],
    overview: IntelligenceOverview,
) -> tuple[str, str, str]:
    """Return (level, headline, summary)."""
    critical = sum(1 for w in warnings if w.severity == "critical")
    warn = sum(1 for w in warnings if w.severity == "warning")

    if critical >= 2 or overview.transcript_coverage_pct < 0.5:
        level = "critical"
    elif critical >= 1 or warn >= 3:
        level = "degraded"
    elif warn >= 1 or overview.transcript_coverage_pct < 5:
        level = "partial"
    else:
        level = "healthy"

    parts: list[str] = []
    if overview.hook_patterns_indexed > 0:
        parts.append("hooks indexed")
    if overview.snapshot_days >= 2:
        parts.append("snapshots running")
    else:
        parts.append("momentum limited")
    if overview.transcript_coverage_pct >= 5:
        parts.append("transcript coverage moderate")
    elif overview.transcript_coverage_pct > 0:
        parts.append("transcript coverage weak")
    else:
        parts.append("transcripts nearly absent")

    headline = {
        "healthy": "Intelligence graph is HEALTHY",
        "partial": "Intelligence graph is PARTIALLY HEALTHY",
        "degraded": "Intelligence graph is DEGRADED",
        "critical": "Intelligence graph is CRITICALLY LIMITED",
    }[level]

    summary = ", ".join(parts) + "."
    return level, headline, summary
