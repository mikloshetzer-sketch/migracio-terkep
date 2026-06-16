import React from "react";

function Layout({ children }) {
  return (
    <div className="app-shell">

      <header className="hero">

        <div>

          <p className="eyebrow">
            Migration Intelligence Center
          </p>

          <h1>
            Global Migration Pressure Monitor
          </h1>

          <p className="lead">

            High-level monitoring of migration pressure,
            geopolitical events, border risks and future
            movement trends.

          </p>

        </div>

        <div className="status-card">

          <span>System Status</span>

          <strong>Operational</strong>

          <small>Awaiting live data connection</small>

        </div>

      </header>

      {children}

    </div>
  );
}

export default Layout;
