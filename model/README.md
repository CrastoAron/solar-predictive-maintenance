# SolarShield — ML Module

**Project**: SolarShield — ML-Driven Predictive Maintenance & Efficiency Analysis  
**College**: St Joseph Engineering College, Mangaluru (VTU)

---

## Quick-start

### 1. Install dependencies
```bash
pip install pandas numpy scikit-learn xgboost joblib fastapi pydantic jupyter matplotlib seaborn
```

### 2. Download dataset
From Kaggle — *anikannal / solar-power-generation-data*:
- `Plant_1_Generation_Data.csv`  →  `data/`
- `Plant_1_Weather_Sensor_Data.csv`  →  `data/`

### 3. Run notebooks in order
```
notebooks/01_data_prep.ipynb        → produces  data/solar_features.csv
notebooks/02_train_classifier.ipynb → produces  ml_models/rf_classifier.pkl
notebooks/03_train_regressor.ipynb  → produces  ml_models/xgb_regressor.pkl
notebooks/04_validation.ipynb       ← MUST PASS before handing off to backend
```

### 4. Register the router in main.py (backend member's task)
```python
from app.routers.ml_router import router as ml_router
app.include_router(ml_router)
```

---

## Deliverables checklist

| File | Status |
|------|--------|
| `ml_models/features.json` | ✅ committed |
| `ml_models/rf_classifier.pkl` | generate via notebook 02 |
| `ml_models/xgb_regressor.pkl` | generate via notebook 03 |
| `app/routers/ml_router.py` | ✅ committed |
| `notebooks/01_data_prep.ipynb` | ✅ committed |
| `notebooks/02_train_classifier.ipynb` | ✅ committed |
| `notebooks/03_train_regressor.ipynb` | ✅ committed |
| `notebooks/04_validation.ipynb` | ✅ committed |

---

## API endpoints (no auth — backend handles token verification upstream)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/ml/classify` | RF fault classification → `{fault_class, fault_label}` |
| POST | `/ml/forecast` | XGB regression → `{efficiency_score, maintenance_days}` |
| GET  | `/ml/health`   | Check model load status |

All POST bodies accept the same 12-feature JSON object (see `SolarFeatures` in `ml_router.py`).

---

## Feature order (never change after handoff)

```
voltage_mean, voltage_std, current_mean, current_std,
power_mean, power_std, lux_mean, temperature_mean, humidity_mean,
power_rate_of_change, voltage_rate_of_change, efficiency_ratio
```

The canonical source of truth is `ml_models/features.json`.  
The backend reads this file at startup — do not rename features.

---

## Phase 2 (after 4+ weeks of real ESP32 data)

1. Export InfluxDB `solar_raw` bucket to CSV
2. Re-run notebooks 01–03 with real data
3. Compare Phase 1 vs Phase 2 metrics in the final report
4. Drop new `.pkl` files into `ml_models/` — backend auto-loads on next restart
