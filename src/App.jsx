import React from "react";
import "./style.css";

const routes = [
  {
    name: "Central Mediterranean Route",
    from: "Libya / Tunisia",
    to: "Italy / Malta",
    level: "Critical",
    pressure: 86
  },
  {
    name: "Eastern Mediterranean Route",
    from: "Türkiye",
    to: "Greece / Cyprus / Balkans",
    level: "High",
    pressure: 72
  },
  {
    name: "Western Balkan Route",
    from: "Serbia / Bosnia",
    to: "Hungary / Croatia / Austria",
    level: "Elevated",
    pressure: 61
  },
  {
    name: "Western Mediterranean Route",
    from: "Morocco / Algeria",
    to: "Spain",
    level: "Moderate",
    pressure: 44
  }
];

const indicators = [
  { label: "Global Migration Pressure", value: "High", score: 78 },
  { label: "EU Border Pressure", value: "Elevated", score: 64 },
  { label: "Conflict Push Factor", value: "Critical", score: 88 },
  { label: "Climate & Food Stress", value: "Rising", score: 59 }
];

function App() {
  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Migration Intelligence Center</p>
          <h1>Global Migration Pressure Monitor</h1>
          <p className="lead">
            A high-level migration monitoring dashboard for tracking pressure zones,
            active routes, border risks and early warning signals.
          </p>
        </div>

        <div className="status-card">
          <span>System Status</span>
          <strong>Operational</strong>
          <small>Demo data layer active</small>
        </div>
      </section>

      <section className="kpi-grid">
        {indicators.map((item) => (
          <article className="kpi-card" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <div className="bar">
              <div style={{ width: `${item.score}%` }} />
            </div>
            <small>{item.score}/100 risk score</small>
          </article>
        ))}
      </section>

      <section className="dashboard-grid">
        <article className="map-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Strategic Map</p>
              <h2>Migration pressure zones</h2>
            </div>
            <span className="badge">Prototype</span>
          </div>

          <div className="map-placeholder">
            <div className="pulse p1" />
            <div className="pulse p2" />
            <div className="pulse p3" />
            <div className="route r1" />
            <div className="route r2" />
            <div className="route r3" />
            <span className="map-label l1">Central Med</span>
            <span className="map-label l2">Balkans</span>
            <span className="map-label l3">Eastern Med</span>
          </div>
        </article>

        <article className="side-panel">
          <p className="eyebrow">Early Warning</p>
          <h2>Next 30 days</h2>
          <p>
            The current model indicates rising pressure on Mediterranean and Balkan
            corridors. The next development step will connect live data sources and
            replace this demo layer with automated JSON feeds.
          </p>

          <div className="forecast-box">
            <span>Forecast level</span>
            <strong>Rising pressure</strong>
            <small>Based on conflict, border, climate and economic indicators.</small>
          </div>
        </article>
      </section>

      <section className="routes-section">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Active Routes</p>
            <h2>Route pressure overview</h2>
          </div>
        </div>

        <div className="route-list">
          {routes.map((route) => (
            <article className="route-card" key={route.name}>
              <div>
                <h3>{route.name}</h3>
                <p>
                  {route.from} → {route.to}
                </p>
              </div>
              <div className="route-score">
                <strong>{route.pressure}</strong>
                <span>{route.level}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export default App;
