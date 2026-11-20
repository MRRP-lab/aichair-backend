import { useEffect, useState } from "react";
import { checkHealth, listReports } from "./api.js";
import { REPORT_TYPES } from "./constants.js";
import ReportMap from "./components/ReportMap.jsx";
import ReportDetails from "./components/ReportDetails.jsx";
import ReportForm from "./components/ReportForm.jsx";

export default function App() {
  const [reports, setReports] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [healthy, setHealthy] = useState(null);
  // where the user clicked the map, for the new report
  const [draft, setDraft] = useState(null);
  // report shown in the panel next to the map
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    checkHealth().then(setHealthy);
    listReports()
      .then(setReports)
      .catch((err) => setLoadError(err.message));
  }, []);

  function handleCreated(report) {
    setReports((current) => [...current, report]);
    setDraft(null);
    setSelectedId(report.id);
  }

  const selected = reports.find((r) => r.id === selectedId) || null;

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Access Barrier Reports</h1>
          <p className="subtitle">Western Washington University &amp; Sehome Hill Arboretum</p>
        </div>
        <span className={`status ${healthy ? "ok" : healthy === false ? "down" : ""}`}>
          {healthy === null ? "checking API…" : healthy ? "API online" : "API offline"}
        </span>
      </header>

      <div className="workspace">
        <section className="map-card">
          <ReportMap
            reports={reports}
            draft={draft}
            onPick={setDraft}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          <div className="map-footer">
            <ul className="legend" aria-label="map legend">
              {REPORT_TYPES.map((t) => (
                <li key={t.name}>
                  <span className="dot" style={{ background: t.color }} />
                  {t.name}
                </li>
              ))}
              <li>
                <span className="dot draft" />
                new report
              </li>
            </ul>
            <span className="count">
              {loadError ? `couldn't load reports: ${loadError}` : `${reports.length} reports`}
            </span>
          </div>
        </section>

        <ReportDetails report={selected} onClose={() => setSelectedId(null)} />
      </div>

      <ReportForm draft={draft} onClearDraft={() => setDraft(null)} onCreated={handleCreated} />
    </div>
  );
}
