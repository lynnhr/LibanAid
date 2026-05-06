from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import numpy as np
import pandas as pd

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load models
rf = joblib.load("random_forest_model.pkl")
km = joblib.load("kmeans_model.pkl")
dtm = pd.read_csv("dtm_clustered.csv")
overlays = pd.read_csv("overlays_with_features.csv")

class ZoneInput(BaseModel):
    region: str
    lat: float
    lng: float
    nearby_events: float
    nearby_fatalities: float
    nearby_population: float
    type_enc: int
    active_enc: int

class DistrictInput(BaseModel):
    idp_count: float
    total_capacity: float
    active_shelters: float

@app.get("/")
def root():
    return {"status": "LibanAid API running"}

@app.post("/predict/severity")
def predict_severity(data: ZoneInput):
    features = [[
        data.lat, data.lng,
        data.nearby_events, data.nearby_fatalities,
        data.nearby_population, data.type_enc, data.active_enc
    ]]
    prediction = rf.predict(features)[0]
    probabilities = rf.predict_proba(features)[0]
    confidence = round(float(max(probabilities)) * 100, 1)
    return {
        "severity": prediction,
        "confidence": confidence,
        "probabilities": {
            cls: round(float(prob) * 100, 1)
            for cls, prob in zip(rf.classes_, probabilities)
        }
    }

@app.post("/predict/cluster")
def predict_cluster(data: DistrictInput):
    from sklearn.preprocessing import StandardScaler
    features = [[data.idp_count, data.total_capacity, data.active_shelters]]
    cluster = int(km.predict(features)[0])
    means = dtm.groupby('cluster')['numPresentIdpInd'].mean().sort_values(ascending=False)
    label_map = {
        int(means.index[0]): 'Overwhelmed',
        int(means.index[1]): 'Moderate',
        int(means.index[2]): 'Available'
    }
    return {
        "cluster": cluster,
        "label": label_map.get(cluster, "Unknown")
    }

@app.get("/districts")
def get_districts():
    result = dtm[['admin1Name','admin2Name','numPresentIdpInd',
                  'total_capacity','active_shelters','cluster_label']]\
             .dropna().to_dict(orient='records')
    return result

@app.get("/shelters/summary")
def shelter_summary():
    return dtm.groupby('admin1Name').agg(
        total_idps=('numPresentIdpInd','sum'),
        total_capacity=('total_capacity','first'),
        active_shelters=('active_shelters','first'),
        cluster=('cluster_label','first')
    ).reset_index().to_dict(orient='records')