from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel


class LiveResponse(BaseModel):
    device_id: str
    timestamp: str
    voltage: float
    current: float
    power: float
    lux: float
    temperature: float
    humidity: float


class HistoryPoint(BaseModel):
    timestamp: str
    value: float


class HistoryResponse(BaseModel):
    field: str
    data: List[HistoryPoint]


class PredictionsResponse(BaseModel):
    fault_class: int
    fault_label: str
    efficiency_score: float
    maintenance_days: int
    predicted_at: str


class AlertItem(BaseModel):
    id: str
    type: str
    severity: str
    message: str
    timestamp: str
    resolved: bool


class AlertsResponse(BaseModel):
    alerts: List[AlertItem]


class MaintenanceResponse(BaseModel):
    days_remaining: int
    next_service_date: Optional[str]
    efficiency_trend: str
    recommendation: str

