"""Confidence scoring for deterministic rule candidates."""

from __future__ import annotations

from diagnostics.models import CandidateCause


def score_candidate(candidate: CandidateCause) -> int:
    """Convert a rule's evidence score into a stable, user-facing 0--100 value."""
    evidence_bonus = min(len(candidate.evidence) * 3, 10)
    return max(0, min(100, round(candidate.score + evidence_bonus)))


def choose_best(candidates: list[CandidateCause]) -> CandidateCause | None:
    """Choose deterministically: highest score, then most supporting evidence, then name."""
    if not candidates:
        return None
    return max(candidates, key=lambda item: (score_candidate(item), len(item.evidence), item.cause))
