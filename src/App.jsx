import React from "react";

import "./style.css";

import Layout from "./components/Layout";

import GlobalMap from "./components/GlobalMap";

import LiveStatus from "./components/LiveStatus";

function App() {

  return (

    <Layout>

      <section className="emic-layout">

        <section className="emic-map-container">

          <div className="map-header">

            <div>

              <p className="eyebrow">

                European Migration Intelligence Center

              </p>

              <h2>

                Live Migration Intelligence Map

              </h2>

            </div>

            <LiveStatus />

          </div>

          <GlobalMap />

        </section>

      </section>

    </Layout>

  );

}

export default App;
