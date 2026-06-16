import React from "react";

import "./style.css";

import Layout from "./components/Layout";

import GlobalMap from "./components/GlobalMap";

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

            <div className="live-status">

              ● LIVE

            </div>

          </div>

          <GlobalMap />

        </section>

      </section>

    </Layout>

  );

}

export default App;
