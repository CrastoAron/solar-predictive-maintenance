from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import CORS_ORIGINS
from routers.alerts import router as alerts_router
from routers.history import router as history_router
from routers.live import router as live_router
from routers.maintenance import router as maintenance_router
from routers.predictions import router as predictions_router
from services.influx_client import get_influx_client
from services.ml_runner import get_ml_runner
from services.mqtt_client import MQTTSubscriber
from services.scheduler import get_prediction_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    influx_client = get_influx_client()
    ml_runner = get_ml_runner()
    mqtt_subscriber = MQTTSubscriber(influx_client=influx_client)
    prediction_scheduler = get_prediction_scheduler(
        influx_client=influx_client,
        ml_runner=ml_runner,
    )

    app.state.influx_client = influx_client
    app.state.ml_runner = ml_runner
    app.state.mqtt_subscriber = mqtt_subscriber
    app.state.prediction_scheduler = prediction_scheduler

    mqtt_subscriber.start()
    prediction_scheduler.start()
    try:
        yield
    finally:
        prediction_scheduler.shutdown()
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
app.include_router(history_router)
app.include_router(predictions_router)
app.include_router(alerts_router)
app.include_router(maintenance_router)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}

