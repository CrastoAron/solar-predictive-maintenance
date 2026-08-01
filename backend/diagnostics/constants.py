"""Status values and conservative thresholds used by diagnostics rules."""

from __future__ import annotations

from enum import IntEnum


class HardwareStatusCode(IntEnum):
    OK = 0
    INITIALIZATION_FAILED = 1
    DEVICE_NOT_FOUND = 2
    INVALID_DATA = 3
    READ_ERROR = 4
    DEVICE_SPECIFIC_ERROR = 5


HARDWARE_STATUS_NAMES = {
    HardwareStatusCode.OK: "OK",
    HardwareStatusCode.INITIALIZATION_FAILED: "Initialization failed",
    HardwareStatusCode.DEVICE_NOT_FOUND: "Device not found",
    HardwareStatusCode.INVALID_DATA: "Invalid data",
    HardwareStatusCode.READ_ERROR: "Read error",
    HardwareStatusCode.DEVICE_SPECIFIC_ERROR: "Device-specific error",
}

HEALTH_LABELS = {0: "Normal", 1: "Degraded", 2: "Fault"}

# Rules only consider operational conditions with meaningful irradiance.
MIN_DAYLIGHT_LUX = 10_000.0
MIN_HISTORY_SAMPLES = 5
LOW_POWER_WATTS = 1.0
LOW_EFFICIENCY_RATIO = 0.55
PARTIAL_SHADING_RATIO = 0.70
DUST_PERSISTENCE_RATIO = 0.75
DEGRADATION_RATIO = 0.80
LOOSE_WIRING_VOLTAGE_RATIO = 0.65
LOOSE_WIRING_CURRENT_RATIO = 0.25
