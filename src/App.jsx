import React from "react";

import "./style.css";

import Layout from "./components/Layout";
import HungaryBorderWatch from "./components/HungaryBorderWatch";

function App() {
  return (
    <Layout>

      <section className="dashboard-grid">

        <article className="map-panel">

          <div className="panel-header">

            <div>

              <p className="eyebrow">

                Strategic Map

              </p>

              <h2>

                Migration pressure zones

              </h2>

            </div>

            <span className="badge">

              Building phase

            </span>

          </div>

          <div className="map-placeholder">

            <div className="pulse p1"></div>

            <div className="pulse p2"></div>

            <div className="pulse p3"></div>

            <div className="route r1"></div>

            <div className="route r2"></div>

            <div className="route r3"></div>

            <span className="map-label l1">

              Central Med

            </span>

            <span className="map-label l2">

              Balkans

            </span>

            <span className="map-label l3">

              Eastern Med

            </span>

          </div>

        </article>

        <article className="side-panel">

          <p className="eyebrow">

            Early Warning

          </p>

          <h2>

            Next 30 days

          </h2>

          <p>

            The first version of the system focuses on
            Sahel, North Africa, Türkiye, Western Balkans,
            Hungary and Central Europe.

          </p>

          <div className="forecast-box">

            <span>

              Forecast level

            </span>

            <strong>

              Rising pressure

            </strong>

            <small>

              Automated data feeds will replace demo data.

            </small>

          </div>

        </article>

      </section>

      <HungaryBorderWatch />

    </Layout>
  );
}

export default App;
