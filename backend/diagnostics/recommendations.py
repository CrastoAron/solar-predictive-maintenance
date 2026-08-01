"""Maintenance actions associated with explainable diagnostic causes."""

from __future__ import annotations


RECOMMENDATIONS = {
    "Sensor Failure": "Inspect the affected sensor, its I2C wiring, power supply, and connector before relying on its readings.",
    "Partial Shading": "Inspect the panel and its surroundings for temporary obstructions or shadows.",
    "Dust Accumulation": "Clean the panel surface using the manufacturer-recommended method and recheck output.",
    "Panel Degradation": "Schedule a panel performance inspection and compare output with its rated specification.",
    "Possible Panel Damage": "Inspect the panel for cracks, hotspots, moisture ingress, and damaged bypass diodes.",
    "Loose Wiring": "Inspect and safely tighten panel, INA219, and connector wiring; look for corrosion or intermittent contacts.",
    "No Fault Detected": "Continue monitoring the system. No deterministic hardware or panel cause was detected.",
}


def recommendation_for(cause: str) -> str:
    return RECOMMENDATIONS.get(cause, "Inspect the solar system and continue monitoring telemetry.")
