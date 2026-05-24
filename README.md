# 🇱🇧 LibanAid — Lebanon Displacement Crisis · ML Aid Coordination System

> Live app: [liban-aid.vercel.app](https://liban-aid.vercel.app)

---

## Overview

LibanAid is a machine learning system built to help NGOs and humanitarian organizations (including the Red Cross) coordinate aid during Lebanon's 2024–2026 displacement crisis. It answers three critical operational questions:

| Question | Model | Output |
|---|---|---|
| How dangerous is this zone? | Random Forest (supervised) | `critical` / `high` / `medium` |
| Which districts are overwhelmed? | K-Means (unsupervised) | `overwhelmed` / `moderate` / `available` |
| Where can families find shelter? | Shelter matching | Capacity by governorate |

---

## Crisis at a Glance

- **1,049,328** registered displaced individuals (March 16, 2026)
- **644** collective shelters — only **24** still had capacity
- **370,000+** children displaced (~19,000/day average)
- **4,395** fatalities recorded 2023–2025
- **89%** of conflict events were explosions or remote violence
- **El Nabatieh**: 19,525 IDPs with **zero** remaining shelter capacity
- **North Lebanon**: 19,464 shelter capacity vs. only 46 IDPs — best evacuation destination

---

## Project Structure

```
libanaid/
├── backend/                        ← FastAPI Python API (hosted on Railway)
│   ├── main.py                     ← API endpoints
│   ├── requirements.txt
│   ├── Procfile                    ← Railway deployment config
│   ├── random_forest_model.pkl     ← Saved RF classifier
│   ├── kmeans_model.pkl            ← Saved K-Means model
│   ├── dtm_clustered.csv           ← Districts with cluster labels
│   └── overlays_with_features.csv
│
├── frontend/                       ← React + Vite app (hosted on Vercel)
│   └── src/
│       ├── App.jsx                 ← Main app (3 pages)
│       └── index.css               ← Dark theme styling
│
└── Data_Analysis_Project.ipynb     ← Full ML pipeline notebook
```

---

## Datasets

### Raw Sources

| # | File | Source | Rows | Role |
|---|------|--------|------|------|
| 1 | `ACLED_Data_20260506.csv` | [acleddata.com](https://acleddata.com/data-export-tool) | 17,528 | RF training data |
| 2 | `lbniomdtmfromapiadmin0to2.csv` | [data.humdata.org](https://data.humdata.org/dataset/e0729389-06d0-48b1-957b-a22168e85ee2) | 8,086 | K-Means input |
| 3 | `map_overlays.csv` | MonitorLebanon Supabase | 1,000 | RF target variable |
| 4 | `events_master.csv` | MonitorLebanon Supabase | 1,000 | 2026 test set |
| 5 | `telegram_messages.csv` | MonitorLebanon Supabase | 1,000 | 2026 incident context |
| 6 | `shelters.csv` | MonitorLebanon Supabase | 1,000 | Shelter matching |

### Preprocessed Files (model-ready)

| File | Rows | Columns | Description |
|------|------|---------|-------------|
| `acled_preprocessed.csv` | 17,528 | 15 | Encoded + scaled conflict events |
| `dtm_preprocessed.csv` | 5,390 | 6 | District-level IDP data |
| `overlays_preprocessed.csv` | 465 | 11 | Zone severity labels |
| `shelters_preprocessed.csv` | 1,000 | 14 | Shelter capacity data |

---

## ML Pipeline

### Step 1 — EDA
Visualized each dataset before preprocessing:
- Conflict events by governorate: South Lebanon + Nabatieh = 90% of all events
- Event types: 89% explosions / remote violence (airstrikes, shelling)
- Fatality spike in October 2023 matching war escalation
- Severity distribution: 502 high · 245 medium · 197 critical · 56 low

### Step 2 — Cleaning
- **ACLED**: retained 9 useful columns, filled missing `population_best` with median
- **DTM**: filtered to district level (`adminLevel == 2`), dropped gender columns (70% missing)
- **Overlays**: merged `low` into `medium` (too few samples), removed coordinate-less rows
- **Shelters**: generated synthetic capacity (`sections_count × 6`) where missing

### Step 3 — Preprocessing
- Label encoding for categorical columns (`event_type`, `admin1`, `facility_type`, etc.)
- StandardScaler normalization for numerical columns (fatalities, IDP counts, capacity)
- Target encoding: `medium=0`, `high=1`, `critical=2`

### Step 4 — Random Forest (Supervised)

Features were built using a **BallTree spatial index** to count ACLED conflict events within 20 km of each overlay zone — linking two datasets with no common join column.

**Features**: `lat`, `lng`, `nearby_events`, `nearby_fatalities`, `nearby_population`, `type_enc`, `active_enc`  
**Split**: 80/20 stratified · 372 train / 93 test  
**Model**: `RandomForestClassifier(n_estimators=100)`

| Metric | Score |
|--------|-------|
| Overall Accuracy | **81%** |
| High Severity F1 | **0.88** |
| Critical Severity F1 | **0.72** |
| Medium Severity F1 | **0.50** *(class imbalance)* |

> The model never confused `critical` with `medium` — only adjacent-class errors occurred.

### Step 5 — K-Means (Unsupervised)

Groups Lebanese districts by displacement pressure. Labels were removed before clustering — patterns discovered autonomously.

**Features**: `numPresentIdpInd` (IDP count), `total_capacity`, `active_shelters`  
**Optimal k**: 3 (elbow method)  
**Silhouette Score**: **0.616** (>0.5 = meaningful separation)

| Cluster | Example Districts | Avg IDPs | Avg Capacity |
|---------|------------------|----------|--------------|
| 🔴 Overwhelmed | El Nabatieh, Sour | 16,006 | 3,003 |
| 🟡 Moderate | Bent Jbeil, Beirut, Saida | 662 | 4,449 |
| 🟢 Available | North Lebanon, Mount Lebanon | 656 | 19,614 |

---

## Web Application

### Architecture

- **Frontend**: React + Vite → [liban-aid.vercel.app](https://liban-aid.vercel.app)
- **Backend**: FastAPI (Python) → [libanaid-production.up.railway.app](https://libanaid-production.up.railway.app)

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/predict/severity` | POST | RF model → severity prediction + confidence |
| `/predict/cluster` | POST | K-Means → displacement pressure cluster |
| `/districts` | GET | DTM district data with cluster labels |
| `/shelters/summary` | GET | Shelter capacity aggregated by governorate |

---

## Running Locally

### Backend
```bash
cd libanaid/backend
pip install fastapi uvicorn scikit-learn pandas numpy joblib
uvicorn main:app --reload
# → http://localhost:8000
```

### Frontend
```bash
cd libanaid/frontend
npm install
npm run dev
# → http://localhost:5173
```

---

## Notebook Execution Order

Run `Data_Analysis_Project.ipynb` sections in this order:

1. **EDA** — visualize all datasets
2. **Cleaning** — drop columns, fill nulls, fix types
3. **Preprocessing** — encode categoricals, scale numericals, save CSVs
4. **Random Forest** — BallTree feature engineering, training, evaluation
5. **K-Means** — aggregate DTM + shelters, elbow, cluster, silhouette

---

## Data Access

### MonitorLebanon Supabase API
```python
import requests, pandas as pd

SUPABASE_URL = "https://gkydpwzufagepcigsmbh.supabase.co"
API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
HEADERS = {
    "apikey": API_KEY,
    "Authorization": f"Bearer {API_KEY}",
    "accept-profile": "public"
}

# Fetch any table (events_master, telegram_messages, map_overlays, shelters)
df = pd.DataFrame(
    requests.get(f"{SUPABASE_URL}/rest/v1/TABLE_NAME?limit=1000", headers=HEADERS).json()
)
```

### IOM DTM Direct Download
```
https://data.humdata.org/dataset/e0729389-06d0-48b1-957b-a22168e85ee2/resource/34e7f993-45dd-4152-895e-31a60dbc4872/download/lbn-iom-dtm-from-api-admin-0-to-2.csv
```

---

## Results Summary

| Model | Type | Performance | Output Labels |
|-------|------|-------------|---------------|
| Random Forest | Supervised | 81% accuracy | `critical` / `high` / `medium` |
| K-Means | Unsupervised | 0.616 silhouette score | `overwhelmed` / `moderate` / `available` |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Data Analysis | Python · Pandas · NumPy · Scikit-learn |
| Spatial Indexing | BallTree (sklearn.neighbors) |
| Models | RandomForestClassifier · KMeans |
| Backend API | FastAPI · Uvicorn |
| Frontend | React · Vite |
| Deployment | Railway (backend) · Vercel (frontend) |

---

*Université Antonine · Data Science Course · S2 2025–2026*
