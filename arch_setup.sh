#!/usr/bin/env bash
# Bootstrap and run SolarShield on Arch Linux.
#
# Usage:
#   ./arch_setup.sh install  # system packages, Python/Node dependencies, Docker services
#   ./arch_setup.sh start    # API, Next.js frontend, and ngrok tunnel
#   ./arch_setup.sh all      # install, then start (default)
#
# Optional environment variables:
#   NGROK_AUTHTOKEN=...     configure ngrok before starting the tunnel
#   INFLUX_ADMIN_PASSWORD=...  initial InfluxDB admin password (default is dev-only)
#   INFLUX_TOKEN=...        initial InfluxDB token (default is dev-only)
#   UPDATE_FRONTEND_NGROK_URL=0  keep the current frontend API URL (default updates it)

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PATH="$HOME/.local/bin:$PATH"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
RUN_DIR="$ROOT_DIR/.run"
INFLUX_CONTAINER="solarshield-influxdb"
MQTT_CONTAINER="solarshield-mosquitto"
MQTT_NETWORK="solarshield-mqtt"
INFLUX_TOKEN="${INFLUX_TOKEN:-solarshield}"
INFLUX_ADMIN_PASSWORD="${INFLUX_ADMIN_PASSWORD:-adminadmin}"
UPDATE_FRONTEND_NGROK_URL="${UPDATE_FRONTEND_NGROK_URL:-1}"
ACTION="${1:-all}"

log() { printf '\n==> %s\n' "$*"; }
die() { printf 'Error: %s\n' "$*" >&2; exit 1; }
command_exists() { command -v "$1" >/dev/null 2>&1; }

case "$ACTION" in
  install|start|all) ;;
  *) die "Usage: $0 [install|start|all]" ;;
esac

if [[ ! -f "$BACKEND_DIR/requirements.txt" || ! -f "$FRONTEND_DIR/package.json" ]]; then
  die "Run this script from the SolarShield repository (or keep it in the repository root)."
fi

docker_cmd=()
configure_docker_command() {
  if docker info >/dev/null 2>&1; then
    docker_cmd=(docker)
  else
    docker_cmd=(sudo docker)
  fi
}

install_ngrok() {
  if command_exists ngrok; then
    return
  fi

  local arch archive url temp_dir
  case "$(uname -m)" in
    x86_64) arch="amd64" ;;
    aarch64) arch="arm64" ;;
    *) die "No automatic ngrok download is configured for architecture $(uname -m)." ;;
  esac

  archive="ngrok-v3-stable-linux-${arch}.tgz"
  url="https://bin.equinox.io/c/bNyj1mQVY4c/${archive}"
  temp_dir="$(mktemp -d)"
  trap 'rm -rf "$temp_dir"' RETURN

  log "Installing ngrok into $HOME/.local/bin"
  mkdir -p "$HOME/.local/bin"
  curl --fail --location --silent --show-error "$url" --output "$temp_dir/$archive"
  tar -xzf "$temp_dir/$archive" -C "$temp_dir"
  install -m 0755 "$temp_dir/ngrok" "$HOME/.local/bin/ngrok"
  export PATH="$HOME/.local/bin:$PATH"
}

install_system_packages() {
  log "Installing Arch Linux packages"
  sudo pacman -Syu --needed --noconfirm \
    base-devel git curl tar python python-pip nodejs npm docker docker-compose

  sudo systemctl enable --now docker
  if ! id -nG "$USER" | tr ' ' '\n' | grep -qx docker; then
    sudo usermod -aG docker "$USER"
    log "Added $USER to the docker group. A new login is needed before Docker works without sudo."
  fi
  install_ngrok
}

setup_backend() {
  log "Creating backend virtual environment and installing Python dependencies"
  if [[ ! -d "$BACKEND_DIR/.venv" ]]; then
    python -m venv "$BACKEND_DIR/.venv"
  fi
  "$BACKEND_DIR/.venv/bin/python" -m pip install --upgrade pip
  "$BACKEND_DIR/.venv/bin/python" -m pip install -r "$BACKEND_DIR/requirements.txt"

  if [[ ! -f "$BACKEND_DIR/.env" ]]; then
    cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
    cat >> "$BACKEND_DIR/.env" <<EOF

# Local Docker InfluxDB settings created by arch_setup.sh
INFLUX_URL=http://localhost:8086
INFLUX_TOKEN=$INFLUX_TOKEN
INFLUX_ORG=solar_org
INFLUX_BUCKET_RAW=solar_raw
INFLUX_BUCKET_PREDICTIONS=solar_predictions
INFLUX_BUCKET_ALERTS=solar_alerts
CORS_ORIGINS=http://localhost:3000
EOF
    log "Created backend/.env. Add Firebase and Supabase values before using authenticated/admin features."
  else
    log "Keeping existing backend/.env unchanged"
  fi
}

setup_frontend() {
  log "Installing frontend dependencies"
  (cd "$FRONTEND_DIR" && npm install)

  if [[ ! -f "$FRONTEND_DIR/.env.local" ]]; then
    cp "$FRONTEND_DIR/.env.local.example" "$FRONTEND_DIR/.env.local"
    log "Created frontend/.env.local. Add Firebase values and set NEXT_PUBLIC_API_URL after ngrok starts."
  else
    log "Keeping existing frontend/.env.local unchanged"
  fi
}

container_exists() {
  "${docker_cmd[@]}" container inspect "$1" >/dev/null 2>&1
}

start_container() {
  local name="$1"
  if container_exists "$name"; then
    "${docker_cmd[@]}" start "$name" >/dev/null 2>&1 || true
  fi
}

setup_docker_services() {
  configure_docker_command
  log "Starting InfluxDB and Mosquitto Docker services"

  if ! "${docker_cmd[@]}" network inspect "$MQTT_NETWORK" >/dev/null 2>&1; then
    "${docker_cmd[@]}" network create "$MQTT_NETWORK" >/dev/null
  fi

  if container_exists "$MQTT_CONTAINER"; then
    start_container "$MQTT_CONTAINER"
  else
    "${docker_cmd[@]}" run -d --name "$MQTT_CONTAINER" \
      --network "$MQTT_NETWORK" \
      -p 1883:1883 \
      -v "$BACKEND_DIR/mosquitto.conf:/mosquitto/config/mosquitto.conf:ro" \
      eclipse-mosquitto:2 >/dev/null
  fi

  if container_exists "$INFLUX_CONTAINER"; then
    start_container "$INFLUX_CONTAINER"
  else
    "${docker_cmd[@]}" run -d --name "$INFLUX_CONTAINER" \
      -p 8086:8086 \
      -v solarshield-influxdb-data:/var/lib/influxdb2 \
      -v solarshield-influxdb-config:/etc/influxdb2 \
      -e DOCKER_INFLUXDB_INIT_MODE=setup \
      -e DOCKER_INFLUXDB_INIT_USERNAME=admin \
      -e DOCKER_INFLUXDB_INIT_PASSWORD="$INFLUX_ADMIN_PASSWORD" \
      -e DOCKER_INFLUXDB_INIT_ORG=solar_org \
      -e DOCKER_INFLUXDB_INIT_BUCKET=solar_raw \
      -e DOCKER_INFLUXDB_INIT_ADMIN_TOKEN="$INFLUX_TOKEN" \
      influxdb:2 >/dev/null
  fi
}

wait_for_url() {
  local url="$1"
  for _ in {1..30}; do
    if curl --fail --silent "$url" >/dev/null; then return 0; fi
    sleep 1
  done
  return 1
}

start_process() {
  local name="$1"
  shift
  local pid_file="$RUN_DIR/$name.pid"
  local log_file="$RUN_DIR/$name.log"

  if [[ -f "$pid_file" ]] && kill -0 "$(<"$pid_file")" 2>/dev/null; then
    log "$name is already running (PID $(<"$pid_file"))"
    return
  fi
  rm -f "$pid_file"
  (cd "$ROOT_DIR" && nohup "$@" >"$log_file" 2>&1 & echo $! >"$pid_file")
  log "Started $name; log: $log_file"
}

stop_managed_process() {
  local name="$1"
  local pid_file="$RUN_DIR/$name.pid"
  if [[ -f "$pid_file" ]] && kill -0 "$(<"$pid_file")" 2>/dev/null; then
    kill "$(<"$pid_file")"
    for _ in {1..10}; do
      kill -0 "$(<"$pid_file")" 2>/dev/null || break
      sleep 1
    done
  fi
  rm -f "$pid_file"
}

ngrok_public_url() {
  curl --fail --silent --show-error http://127.0.0.1:4040/api/tunnels | \
    python -c 'import json, sys; print(next((t["public_url"] for t in json.load(sys.stdin).get("tunnels", []) if t.get("proto") == "https"), ""))'
}

set_frontend_api_url() {
  local api_url="$1"
  local env_file="$FRONTEND_DIR/.env.local"
  [[ -f "$env_file" ]] || die "Missing $env_file. Run '$0 install' first."

  python - "$env_file" "$api_url" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
api_url = sys.argv[2]
lines = path.read_text().splitlines()
key = "NEXT_PUBLIC_API_URL="
updated = False
out = []
for line in lines:
    if line.strip().startswith(key):
        out.append(key + api_url)
        updated = True
    else:
        out.append(line)
if not updated:
    out.append(key + api_url)
path.write_text("\n".join(out) + "\n")
PY
}

start_application() {
  mkdir -p "$RUN_DIR"
  configure_docker_command
  setup_docker_services

  command_exists ngrok || die "ngrok is not installed. Run '$0 install' first."
  local ngrok_bin
  ngrok_bin="$(command -v ngrok)"
  if [[ -n "${NGROK_AUTHTOKEN:-}" ]]; then
    "$ngrok_bin" config add-authtoken "$NGROK_AUTHTOKEN" >/dev/null
  fi

  start_process backend bash -lc "cd '$BACKEND_DIR' && exec .venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000"
  if ! wait_for_url "http://localhost:8000/health"; then
    die "Backend did not become healthy. Check $RUN_DIR/backend.log"
  fi

  start_process ngrok "$ngrok_bin" http 8000
  local public_url=""
  for _ in {1..15}; do
    public_url="$(ngrok_public_url 2>/dev/null || true)"
    [[ -n "$public_url" ]] && break
    sleep 1
  done
  [[ -n "$public_url" ]] || die "ngrok did not expose an HTTPS tunnel. Check $RUN_DIR/ngrok.log"

  if [[ "$UPDATE_FRONTEND_NGROK_URL" == "1" ]]; then
    set_frontend_api_url "$public_url"
    # NEXT_PUBLIC variables are compiled into Next.js's browser bundle.
    stop_managed_process frontend
    log "Set NEXT_PUBLIC_API_URL to the active ngrok tunnel"
  fi
  start_process frontend bash -lc "cd '$FRONTEND_DIR' && exec npm run dev"

  log "Services started"
  printf '%s\n' \
    "Frontend: http://localhost:3000" \
    "Backend:  http://localhost:8000/health" \
    "Public API: $public_url" \
    "ngrok UI:  http://127.0.0.1:4040" \
    "Logs:      $RUN_DIR"
  printf '%s\n' "Update the ESP32 NGROK_TELEMETRY_URL to: $public_url/api/telemetry"
  if [[ -z "${NGROK_AUTHTOKEN:-}" ]]; then
    printf '%s\n' "Set NGROK_AUTHTOKEN before running if ngrok asks for authentication."
  fi
}

if [[ "$ACTION" == "install" || "$ACTION" == "all" ]]; then
  install_system_packages
  setup_backend
  setup_frontend
  setup_docker_services
fi

if [[ "$ACTION" == "start" || "$ACTION" == "all" ]]; then
  start_application
fi
