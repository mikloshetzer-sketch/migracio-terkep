import React from "react";

function Layout({ children }) {
  return (
    <div className="app-shell">

      <header className="blog-dashboard-header">

        <div className="blog-dashboard-brand">

          <div className="brand-copy">

            <p className="brand-site">
              TÖRÉSVONALAK.BLOG
            </p>

            <h1 className="brand-title">
              EU Migration Intelligence Dashboard
            </h1>

            <p className="brand-lead">
              Elemzés. Tények. Kontextus. ·
              Az európai migrációs érkezések,
              származási országok, belépési pontok
              és útvonalak adatvezérelt követése.
            </p>

          </div>

        </div>

        <div className="blog-dashboard-actions">

          <button
            type="button"
            className="dashboard-action dashboard-action-secondary"
            onClick={() => {
              window.location.reload();
            }}
          >
            Adatok frissítése
          </button>

          <a
            className="dashboard-action dashboard-action-primary"
            href="https://toresvonalak.blog/"
            target="_blank"
            rel="noreferrer"
          >
            Törésvonalak.blog
          </a>

        </div>

      </header>

      {children}

    </div>
  );
}

export default Layout;
