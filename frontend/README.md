# SolarShield Frontend

The frontend is a Next.js 14 dashboard for SolarShield monitoring and
administration. It uses Firebase authentication and calls the FastAPI backend
for telemetry, expected-power status, diagnostics, alerts, maintenance, and
administrator data.

## Pages

| Route | Purpose |
| --- | --- |
| `/` | Landing page |
| `/login` | Firebase sign-in |
| `/dashboard` | Live telemetry, expected power, hardware status, and diagnostics |
| `/history` | Historical sensor charts |
| `/trends` | Performance trends |
| `/alerts` | Active and historical alerts |
| `/maintenance` | Maintenance guidance |
| `/admin/dashboard` | Administrator overview |
| `/admin/customers` | Customer, panel array, and panel management |

## Requirements

- Node.js 18 or later
- A running SolarShield backend
- Firebase web-app configuration

## Setup

```bash
cd frontend
npm install
cp .env.local.example .env.local
```

Set the Firebase values and backend base URL in `.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_API_URL=http://localhost:8000
```

For a public ngrok backend, set `NEXT_PUBLIC_API_URL` to the HTTPS tunnel URL
without a trailing endpoint path. Restart the development server after changing
any `NEXT_PUBLIC_*` variable.

## Run

```bash
npm run dev
```

Open `http://localhost:3000`.

## Data displayed

The dashboard uses the expected-power and diagnostics APIs as the main health
path:

- Actual power, expected power, and performance ratio
- Operational status: Normal, Underperforming, Strong anomaly, or low light
- ESP32 BME280, INA219, BH1750, and DS3231 status codes
- Explainable root cause, confidence, evidence, and recommendation

Low light is not shown as a panel fault. A diagnostic cause is only an
evidence-based rule result; it is not a confirmed physical diagnosis.

## Verification

```bash
npm exec tsc -- --noEmit
```

The frontend expects Firebase Bearer-token authentication for backend read APIs.
Administrator pages additionally require an administrator role from the backend.
