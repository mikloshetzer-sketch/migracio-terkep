import React from "react";
import "./style.css";
import Layout from "./components/Layout";

const indicators = [
  {
    label: "Global Migration Pressure",
    value: "High",
    score: 78,
    note: "Conflict, economy and climate drivers combined"
  },
  {
    label: "EU Border Pressure",
    value: "Elevated",
    score: 64,
    note: "Mediterranean and Balkan corridors under observation"
  },
  {
    label: "Conflict Push Factor",
    value: "Critical",
    score: 88,
    note: "Sahel, Middle East and North Africa remain key drivers"
  },
  {
    label: "Climate & Food Stress",
    value: "Rising",
    score: 59,
    note: "Weather shocks and food prices increase movement risk"
  }
];

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

function App() {
  return (
    <Layout>
      <section className="kpi-grid">
        {indicators.map((item) => (
          <article className="kpi-card" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <div className="bar">
              <div style={{ width: `${item.score}%` }} />
            </div>
            <small>{item.score}/100 risk score</small>
            <p>{item.note}</p>
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
            The current model indicates rising pressure on Mediterranean and
            Balkan corridors. The next development step will replace this demo
            layer with structured migration data and automated JSON feeds.
          </p>

          <div className="forecast-box">
            <span>Forecast level</span>
            <strong>Rising pressure</strong>
            <small>
              Based on conflict, border, climate and economic indicators.
            </small>
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
    </Layout>
  );
}

export default App;
