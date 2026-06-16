import React from "react";
import "./style.css";

import Layout from "./components/Layout";
import GlobalMap from "./components/GlobalMap";

function App() {
  return (
    <Layout>
      <section className="dashboard-grid">
        <article className="map-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Live Strategic Map</p>
              <h2>European Migration Intelligence Center</h2>
            </div>
            <span className="badge">Live GeoJSON Layer</span>
          </div>

          <GlobalMap />
        </article>

        <article className="side-panel">
          <p className="eyebrow">System Focus</p>
          <h2>Sahel → Balkans → Hungary</h2>

          <p>
            This live map tracks migration corridors and pressure hotspots from
            North Africa, Türkiye and the Western Balkans toward Hungary and
            Central Europe.
          </p>

          <div className="forecast-box">
            <span>Data mode</span>
            <strong>GeoJSON based</strong>
            <small>
              Corridors and hotspots are loaded from public data files.
            </small>
          </div>
        </article>
      </section>
    </Layout>
  );
}

export default App;
