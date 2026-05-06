import { useState, useEffect } from 'react'
import axios from 'axios'

const API = 'https://libanaid-production.up.railway.app'

const advice = {
  critical: 'Immediate response needed. Direct aid and evacuation teams to this region.',
  high: 'High priority. Pre-position supplies and monitor shelter capacity.',
  medium: 'Moderate risk. Ensure shelters are on standby.'
}

const regions = [
  { label: 'South Lebanon — Nabatieh / Sour', lat: 33.27, lng: 35.20, events: 7800, fatalities: 1580, population: 4200, type_enc: 1, active_enc: 1 },
  { label: 'Baalbek-El Hermel', lat: 34.00, lng: 36.21, events: 3200, fatalities: 620, population: 3800, type_enc: 1, active_enc: 1 },
  { label: 'Bekaa Valley', lat: 33.85, lng: 35.90, events: 2100, fatalities: 490, population: 3500, type_enc: 1, active_enc: 1 },
  { label: 'Beirut southern suburbs', lat: 33.85, lng: 35.49, events: 1800, fatalities: 380, population: 38000, type_enc: 2, active_enc: 1 },
  { label: 'Beirut city center', lat: 33.89, lng: 35.50, events: 800, fatalities: 180, population: 42000, type_enc: 2, active_enc: 1 },
  { label: 'Mount Lebanon', lat: 33.81, lng: 35.60, events: 400, fatalities: 60, population: 18000, type_enc: 0, active_enc: 1 },
  { label: 'North Lebanon — Tripoli', lat: 34.43, lng: 35.83, events: 120, fatalities: 18, population: 28000, type_enc: 0, active_enc: 1 },
  { label: 'Akkar', lat: 34.55, lng: 36.13, events: 80, fatalities: 10, population: 12000, type_enc: 0, active_enc: 1 },
]

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [districts, setDistricts] = useState([])
  const [shelters, setShelters] = useState([])
  const [selectedRegion, setSelectedRegion] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    axios.get(`${API}/districts`).then(r => setDistricts(r.data)).catch(() => {})
    axios.get(`${API}/shelters/summary`).then(r => setShelters(r.data)).catch(() => {})
  }, [])

  async function predictSeverity() {
    const region = regions.find(r => r.label === selectedRegion)
    if (!region) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await axios.post(`${API}/predict/severity`, {
        region: region.label,
        lat: region.lat,
        lng: region.lng,
        nearby_events: region.events,
        nearby_fatalities: region.fatalities,
        nearby_population: region.population,
        type_enc: region.type_enc,
        active_enc: region.active_enc
      })
      setResult(res.data)
    } catch (e) {
      setError('Could not connect to model API. Is the backend running?')
    }
    setLoading(false)
  }

  const overwhelmed = districts.filter(d => d.cluster_label === 'Overwhelmed')
  const available = shelters.filter(d => d.cluster === 'Available')

  return (
    <div className="app">
      <div className="header">
        <div className="logo">LIBAN<span>AID</span></div>
        <div className="nav">
          {['dashboard', 'predict', 'shelters'].map(p => (
            <button key={p} className={page === p ? 'active' : ''} onClick={() => setPage(p)}>
              {p === 'dashboard' ? 'Dashboard' : p === 'predict' ? 'Predict severity' : 'Find shelter'}
            </button>
          ))}
        </div>
      </div>

      {page === 'dashboard' && (
        <>
          <div className="stats-grid">
            <div className="stat"><div className="stat-label">Total IDPs</div><div className="stat-value red">1,049,328</div></div>
            <div className="stat"><div className="stat-label">Overwhelmed districts</div><div className="stat-value red">{overwhelmed.length || 2}</div></div>
            <div className="stat"><div className="stat-label">Available shelters</div><div className="stat-value green">{available.length || 11}</div></div>
            <div className="stat"><div className="stat-label">Model accuracy</div><div className="stat-value">81%</div></div>
          </div>
          <div className="grid-2">
            <div className="card">
              <div className="card-title">District clusters — K-Means results</div>
              {districts.length > 0 ? districts.map((d, i) => (
                <div className="row" key={i}>
                  <div>
                    <div className="row-name">{d.admin2Name} — {d.admin1Name}</div>
                    <div className="row-sub">{d.numPresentIdpInd.toLocaleString()} IDPs · {d.total_capacity.toLocaleString()} capacity</div>
                  </div>
                  <span className={`badge ${d.cluster_label}`}>{d.cluster_label}</span>
                </div>
              )) : (
                <div className="loading">Loading districts...</div>
              )}
            </div>
            <div className="card">
              <div className="card-title">Shelter gap by governorate</div>
              {shelters.map((s, i) => {
                const gap = s.total_idps - s.total_capacity
                const maxAbs = 26029
                const pct = Math.round(Math.min(Math.abs(gap) / maxAbs * 100, 100))
                const color = gap > 0 ? '#E24B4A' : '#1D9E75'
                return (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span>{s.admin1Name}</span>
                      <span style={{ color, fontFamily: 'DM Mono, monospace' }}>{gap > 0 ? '+' : ''}{gap.toLocaleString()}</span>
                    </div>
                    <div style={{ height: 3, background: '#222', borderRadius: 2 }}>
                      <div style={{ height: 3, width: `${pct}%`, background: color, borderRadius: 2 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {page === 'predict' && (
        <div className="card predict-card">
          <div className="card-title">Predict zone severity</div>
          <p style={{ fontSize: 13, color: '#555', marginBottom: 8 }}>
            Select a region — the Random Forest model will predict how critical it is.
          </p>
          <div className="field-label">Region</div>
          <select value={selectedRegion} onChange={e => setSelectedRegion(e.target.value)}>
            <option value="">— Choose a region —</option>
            {regions.map(r => <option key={r.label} value={r.label}>{r.label}</option>)}
          </select>
          <button className="predict-btn" onClick={predictSeverity} disabled={!selectedRegion || loading}>
            {loading ? 'Predicting...' : 'Predict severity →'}
          </button>
          {error && <div className="error">{error}</div>}
          {result && (
            <div className="result-box">
              <div style={{ fontSize: 12, color: '#555', marginBottom: 6 }}>Predicted severity</div>
              <div className={`result-severity ${result.severity}`}>{result.severity.toUpperCase()}</div>
              <div style={{ fontSize: 13, color: '#555', marginTop: 8 }}>{result.confidence}% confidence</div>
              <div className="conf-bar">
                <div className="conf-fill" style={{
                  width: `${result.confidence}%`,
                  background: result.severity === 'critical' ? '#E24B4A' : result.severity === 'high' ? '#EF9F27' : '#1D9E75'
                }} />
              </div>
              <div className="advice">{advice[result.severity]}</div>
              <div style={{ marginTop: 12, fontSize: 12, color: '#444' }}>
                {Object.entries(result.probabilities).map(([cls, prob]) => (
                  <span key={cls} style={{ marginRight: 12 }}>{cls}: {prob}%</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {page === 'shelters' && (
        <div className="card">
          <div className="card-title">Shelter availability by governorate</div>
          {shelters.map((s, i) => (
            <div className="row" key={i}>
              <div>
                <div className="row-name">{s.admin1Name}</div>
                <div className="row-sub">{Math.round(s.active_shelters)} active shelters · {Math.round(s.total_capacity).toLocaleString()} total capacity · {Math.round(s.total_idps).toLocaleString()} IDPs</div>
              </div>
              <span className={`badge ${s.cluster}`}>{s.cluster}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}