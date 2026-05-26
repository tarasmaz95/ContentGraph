#!/usr/bin/env python3
"""
Run transcript enrichment for top-viewed videos (docker-friendly).

Example:
  docker compose exec backend python scripts/run_transcript_enrichment_batch.py --limit 10
  docker compose exec backend python scripts/run_transcript_enrichment_batch.py --limit 100 --delay 0.4
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys

from app.db.session import AsyncSessionLocal, ensure_pgvector_extension
from app.services.transcripts.transcript_enrichment_batch import (
    TranscriptEnrichmentBatch,
)


async def main() -> int:
    parser = argparse.ArgumentParser(description="Transcript enrichment batch runner")
    parser.add_argument("--limit", type=int, default=10, help="Top N by views_count")
    parser.add_argument(
        "--delay",
        type=float,
        default=0.5,
        help="Seconds between videos (1–3 req/s ≈ 0.33–1.0)",
    )
    parser.add_argument("--retries", type=int, default=1, help="Retries per fetch")
    parser.add_argument(
        "--include-existing",
        action="store_true",
        help="Include videos that already have transcripts",
    )
    parser.add_argument("--stats-only", action="store_true", help="Print catalog stats only")
    args = parser.parse_args()

    await ensure_pgvector_extension()

    async with AsyncSessionLocal() as db:
        if args.stats_only:
            stats = await TranscriptEnrichmentBatch.catalog_stats(db)
            print(json.dumps({"catalog": stats}, indent=2))
            return 0

        before = await TranscriptEnrichmentBatch.catalog_stats(db)
        batch = TranscriptEnrichmentBatch(db)
        report = await batch.run(
            limit=args.limit,
            delay_seconds=args.delay,
            retries=args.retries,
            skip_existing=not args.include_existing,
        )
        after = await TranscriptEnrichmentBatch.catalog_stats(db)

    payload = {
        "before": before,
        "after": after,
        "report": report.to_dict(),
    }
    print(json.dumps(payload, indent=2))

    if report.success_count == 0 and args.limit > 0:
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
