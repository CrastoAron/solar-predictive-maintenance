from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import BACKEND_MODE, CORS_ORIGINS
from dependencies import get_current_user
from routers.admin import router as admin_router
from routers.alerts import router as alerts_router
from routers.diagnostics import router as diagnostics_router
from routers.expected_power import router as expected_power_router
from routers.history import router as history_router
from routers.ingest import router as ingest_router
from routers.hardware_status import router as hardware_status_router
from routers.live import router as live_router
from routers.maintenance import router as maintenance_router
from routers.predictions import router as predictions_router
from services.influx_client import get_influx_client
from services.expected_power_runner import get_expected_power_runner
from services.mqtt_client import MQTTSubscriber
from services.cloudflare_tunnel import CloudflareTunnel
from services.scheduler import get_prediction_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    influx_client = get_influx_client()
    expected_power_runner = get_expected_power_runner()
    mqtt_subscriber = MQTTSubscriber(influx_client=influx_client) if BACKEND_MODE == "mqtt" else None
    cloudflare_tunnel = CloudflareTunnel() if BACKEND_MODE == "https" else None
    prediction_scheduler = get_prediction_scheduler(
        influx_client=influx_client,
        expected_power_runner=expected_power_runner,
    )

    app.state.influx_client = influx_client
    app.state.expected_power_runner = expected_power_runner
    app.state.mqtt_subscriber = mqtt_subscriber
    app.state.prediction_scheduler = prediction_scheduler
    app.state.cloudflare_tunnel = cloudflare_tunnel

    try:
        if mqtt_subscriber:
            mqtt_subscriber.start()
        prediction_scheduler.start()
        if cloudflare_tunnel:
            cloudflare_tunnel.start()
            print("\n========================================")
            print("Backend Mode: HTTPS")
            print("========================================\n")
            print("FastAPI:")
            print("http://0.0.0.0:8000\n")
            print("Cloudflare Tunnel:")
            print("CONNECTED\n")
            print("Public URL:")
            print(f"{cloudflare_tunnel.public_url}\n")
            print("ESP32 Endpoint:")
            print(f"{cloudflare_tunnel.public_url}/ingest/sensor\n")
            print("Backend Ready")
            print("========================================")
        yield
    finally:
        prediction_scheduler.shutdown()
        if cloudflare_tunnel:
            cloudflare_tunnel.stop()
        if mqtt_subscriber:
            mqtt_subscriber.stop()
        influx_client.close()


app = FastAPI(
    title="SolarShield Backend",
    description="ML-driven predictive maintenance and efficiency analysis backend.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(live_router)
app.include_router(ingest_router)
app.include_router(history_router)
app.include_router(hardware_status_router)
app.include_router(expected_power_router)
app.include_router(predictions_router)
app.include_router(alerts_router)
app.include_router(maintenance_router)
app.include_router(diagnostics_router)
app.include_router(admin_router)


@app.get("/auth/me")
async def auth_me(user: dict = Depends(get_current_user)) -> dict[str, str | None]:
    return {
        "uid": user.get("uid"),
        "role": (user.get("role") or "customer").lower(),
    }


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
