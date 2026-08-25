from __future__ import annotations

import json
from typing import Any

import paho.mqtt.client as mqtt

from config import MQTT_HOST, MQTT_PORT, MQTT_QOS, MQTT_TOPIC
from services.influx_client import InfluxClient
from services.telemetry import ingest_sensor_payload


class MQTTSubscriber:
    def __init__(
        self,
        *,
        influx_client: InfluxClient,
        host: str = MQTT_HOST,
        port: int = MQTT_PORT,
        topic: str = MQTT_TOPIC,
        qos: int = MQTT_QOS,
    ) -> None:
        self._influx = influx_client
        self._host = host
        self._port = port
        self._topic = topic
        self._qos = qos

        self._client = mqtt.Client()
        self._client.on_connect = self._on_connect
        self._client.on_message = self._on_message

        self._started = False

    def start(self) -> None:
        if self._started:
            return
        self._client.connect(self._host, self._port, keepalive=60)
        # paho manages its own thread; this does not block FastAPI's event loop.
        self._client.loop_start()
        self._started = True

    def stop(self) -> None:
        if not self._started:
            return
        try:
            self._client.loop_stop()
        finally:
            self._client.disconnect()
            self._started = False

    def _on_connect(self, client: mqtt.Client, userdata: Any, flags: dict[str, Any], rc: int) -> None:
        # Subscribe once connected.
        client.subscribe(self._topic, qos=self._qos)

    def _on_message(self, client: mqtt.Client, userdata: Any, msg: mqtt.MQTTMessage) -> None:
        try:
            payload_str = msg.payload.decode("utf-8")
            payload = json.loads(payload_str)
        except Exception:
            return

        try:
            ingest_sensor_payload(payload, self._influx)
        except Exception:
            # Handle missing/null sensor values gracefully by skipping invalid points.
            return
