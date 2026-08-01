"""Rule orchestration and evidence collection for diagnostics."""

from __future__ import annotations

from collections.abc import Iterable

from diagnostics.models import CandidateCause
from diagnostics.rules import DEFAULT_RULES, DiagnosticContext, DiagnosticRule


class DiagnosticsAnalyzer:
    def __init__(self, rules: Iterable[DiagnosticRule] = DEFAULT_RULES) -> None:
        self._rules = tuple(rules)

    def analyze(self, context: DiagnosticContext) -> list[CandidateCause]:
        """Evaluate every rule independently and retain all supported causes."""
        candidates: list[CandidateCause] = []
        for rule in self._rules:
            candidate = rule.evaluate(context)
            if candidate is not None:
                candidates.append(candidate)
        return candidates
