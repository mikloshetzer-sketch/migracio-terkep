import React, { useEffect, useMemo, useState } from "react";

import "./style.css";

import Layout from "./components/Layout";

function formatNumber(value) {
  if (!Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("hu-HU").format(value);
}

function formatPercent(value) {
  if (!Number.isFinite(value)) {
    return "—";
  }

  const sign = value > 0 ? "+" : "";

  return `${sign}${value.toLocaleString("hu-HU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}%`;
}

function formatMonth(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(`${value}T00:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("hu-HU", {
    year: "numeric",
    month: "long",
    timeZone: "UTC"
  });
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(`${value}T00:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("hu-HU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC"
  });
}

const COUNTRY_COLORS = {
  GR: "#16a34a",
  IT: "#1680c1",
  ES: "#e89a1c",
  CY: "#7c3aed"
};

const ORIGIN_COLORS = [
  "#1680c1",
  "#16a34a",
  "#e89a1c",
  "#7c3aed",
  "#dc5a5a"
];

function App() {
  const [summary, setSummary] = useState(null);
  const [arrivals, setArrivals] = useState(null);
  const [countries, setCountries] = useState(null);
  const [origins, setOrigins] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        const [
          summaryResponse,
          arrivalsResponse,
          countriesResponse,
          originsResponse
        ] = await Promise.all([
          fetch("./data/migration/summary.json", {
            cache: "no-store"
          }),

          fetch("./data/migration/unhcr-arrivals.json", {
            cache: "no-store"
          }),

          fetch("./data/migration/country-arrivals.json", {
            cache: "no-store"
          }),

          fetch("./data/migration/origin-countries.json", {
            cache: "no-store"
          })
        ]);

        if (!summaryResponse.ok) {
          throw new Error(
            `summary.json HTTP ${summaryResponse.status}`
          );
        }

        if (!arrivalsResponse.ok) {
          throw new Error(
            `unhcr-arrivals.json HTTP ${arrivalsResponse.status}`
          );
        }

        if (!countriesResponse.ok) {
          throw new Error(
            `country-arrivals.json HTTP ${countriesResponse.status}`
          );
        }

        if (!originsResponse.ok) {
          throw new Error(
            `origin-countries.json HTTP ${originsResponse.status}`
          );
        }

        const [
          summaryData,
          arrivalsData,
          countriesData,
          originsData
        ] = await Promise.all([
          summaryResponse.json(),
          arrivalsResponse.json(),
          countriesResponse.json(),
          originsResponse.json()
        ]);

        if (!active) {
          return;
        }

        setSummary(summaryData);
        setArrivals(arrivalsData);
        setCountries(countriesData);
        setOrigins(originsData);
      } catch (loadError) {
        if (!active) {
          return;
        }

        console.error(loadError);

        setError(
          "A migrációs adatok jelenleg nem tölthetők be."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, []);

  const monthly = useMemo(() => {
    if (!Array.isArray(arrivals?.monthly)) {
      return [];
    }

    return arrivals.monthly;
  }, [arrivals]);

  const countryRows = useMemo(() => {
    if (!Array.isArray(countries?.countries)) {
      return [];
    }

    return countries.countries.filter(
      (item) =>
        Number.isFinite(item.arrivals_ytd)
    );
  }, [countries]);

  const topOrigins = useMemo(() => {
    if (!Array.isArray(origins?.origin_totals)) {
      return [];
    }

    return origins.origin_totals
      .filter(
        (item) =>
          item.is_aggregate_origin !== true &&
          Number.isFinite(item.people)
      )
      .slice(0, 5);
  }, [origins]);

  const maxMonthlyValue = useMemo(() => {
    if (monthly.length === 0) {
      return 1;
    }

    return Math.max(
      ...monthly.map((item) =>
        Number.isFinite(item.people)
          ? item.people
          : 0
      ),
      1
    );
  }, [monthly]);

  const maxOriginValue = useMemo(() => {
    if (topOrigins.length === 0) {
      return 1;
    }

    return Math.max(
      ...topOrigins.map((item) =>
        Number.isFinite(item.people)
          ? item.people
          : 0
      ),
      1
    );
  }, [topOrigins]);

  const countryDonutBackground = useMemo(() => {
    if (countryRows.length === 0) {
      return "conic-gradient(#dfe7ed 0deg 360deg)";
    }

    const total =
      countryRows.reduce(
        (sum, item) =>
          sum + item.arrivals_ytd,
        0
      );

    if (!Number.isFinite(total) || total <= 0) {
      return "conic-gradient(#dfe7ed 0deg 360deg)";
    }

    let cursor = 0;

    const segments =
      countryRows.map((item) => {
        const share =
          item.arrivals_ytd / total;

        const start =
          cursor * 360;

        cursor += share;

        const end =
          cursor * 360;

        const color =
          COUNTRY_COLORS[item.country_code] ??
          "#64748b";

        return `${color} ${start}deg ${end}deg`;
      });

    return `conic-gradient(${segments.join(", ")})`;
  }, [countryRows]);

  if (loading) {
    return (
      <Layout>
        <main className="migration-dashboard">
          <section className="migration-state-card">
            <p className="eyebrow">
              EU Migration Intelligence
            </p>

            <h1>
              Migrációs adatok betöltése
            </h1>

            <p>
              Az UNHCR adatok betöltése folyamatban van.
            </p>
          </section>
        </main>
      </Layout>
    );
  }

  if (error || !summary) {
    return (
      <Layout>
        <main className="migration-dashboard">
          <section className="migration-state-card">
            <p className="eyebrow">
              EU Migration Intelligence
            </p>

            <h1>
              Adatbetöltési hiba
            </h1>

            <p>
              {error ??
                "A migrációs összesítés nem érhető el."}
            </p>
          </section>
        </main>
      </Layout>
    );
  }

  const headline =
    summary.headline ?? {};

  const periods =
    summary.periods ?? {};

  const latestMonth =
    summary.latest_month ?? {};

  const comparison =
    summary.complete_month_comparison ?? {};

  const status =
    summary.data_status ?? {};

  const sevenDay =
    periods.last_7_days ?? {};

  const thirtyDay =
    periods.last_30_days ?? {};

  const countrySummary =
    countries?.summary ?? {};

  const originSummary =
    origins?.summary ?? {};

  const strongestMovement =
    originSummary.strongest_observed_movement ?? null;

  return (
    <Layout>
      <main className="migration-dashboard">

        <section className="migration-kpi-grid">
          <article className="migration-kpi migration-kpi-primary">
            <span className="migration-kpi-label">
              2026 YTD
            </span>

            <strong className="migration-kpi-value">
              {formatNumber(
                headline.arrivals_ytd
              )}
            </strong>

            <span className="migration-kpi-unit">
              regisztrált érkezés
            </span>
          </article>

          <article className="migration-kpi">
            <span className="migration-kpi-label">
              Elmúlt 7 nap
            </span>

            <strong className="migration-kpi-value">
              {sevenDay.available
                ? formatNumber(
                    sevenDay.arrivals
                  )
                : "—"}
            </strong>

            <span className="migration-kpi-unit">
              {sevenDay.available
                ? "újonnan jelentett érkezés"
                : "történeti adat gyűjtése folyamatban"}
            </span>
          </article>

          <article className="migration-kpi">
            <span className="migration-kpi-label">
              Elmúlt 30 nap
            </span>

            <strong className="migration-kpi-value">
              {thirtyDay.available
                ? formatNumber(
                    thirtyDay.arrivals
                  )
                : "—"}
            </strong>

            <span className="migration-kpi-unit">
              {thirtyDay.available
                ? "újonnan jelentett érkezés"
                : "történeti adat gyűjtése folyamatban"}
            </span>
          </article>

          <article className="migration-kpi">
            <div className="migration-kpi-heading">
              <span className="migration-kpi-label">
                Aktuális hónap
              </span>

              {latestMonth.month_status ===
                "partial" && (
                <span className="partial-badge">
                  Részleges
                </span>
              )}
            </div>

            <strong className="migration-kpi-value">
              {formatNumber(
                latestMonth.arrivals
              )}
            </strong>

            <span className="migration-kpi-unit">
              {formatMonth(
                latestMonth.date
              )}
            </span>
          </article>
        </section>

        <section className="migration-content-grid">
          <article className="migration-panel migration-arrival-panel">
            <div className="migration-panel-header">
              <div>
                <p className="panel-eyebrow">
                  Érkezési mód
                </p>

                <h2>
                  Tengeri és szárazföldi érkezések
                </h2>
              </div>

              <span className="panel-total">
                {formatNumber(
                  headline.arrivals_ytd
                )}{" "}
                fő
              </span>
            </div>

            <div className="arrival-mode-grid">
              <div className="arrival-mode">
                <div className="arrival-mode-heading">
                  <span>
                    Tengeri
                  </span>

                  <strong>
                    {formatNumber(
                      headline.sea_arrivals_ytd
                    )}
                  </strong>
                </div>

                <div className="arrival-progress">
                  <span
                    style={{
                      width: `${Math.min(
                        Math.max(
                          headline.sea_share_percent ??
                            0,
                          0
                        ),
                        100
                      )}%`
                    }}
                  />
                </div>

                <span className="arrival-share">
                  {Number.isFinite(
                    headline.sea_share_percent
                  )
                    ? `${headline.sea_share_percent.toLocaleString(
                        "hu-HU"
                      )}%`
                    : "—"}
                </span>
              </div>

              <div className="arrival-mode">
                <div className="arrival-mode-heading">
                  <span>
                    Szárazföldi
                  </span>

                  <strong>
                    {formatNumber(
                      headline.land_arrivals_ytd
                    )}
                  </strong>
                </div>

                <div className="arrival-progress">
                  <span
                    style={{
                      width: `${Math.min(
                        Math.max(
                          headline.land_share_percent ??
                            0,
                          0
                        ),
                        100
                      )}%`
                    }}
                  />
                </div>

                <span className="arrival-share">
                  {Number.isFinite(
                    headline.land_share_percent
                  )
                    ? `${headline.land_share_percent.toLocaleString(
                        "hu-HU"
                      )}%`
                    : "—"}
                </span>
              </div>
            </div>
          </article>

          <article className="migration-panel migration-comparison-panel">
            <div className="migration-panel-header">
              <div>
                <p className="panel-eyebrow">
                  Lezárt hónapok
                </p>

                <h2>
                  Havi változás
                </h2>
              </div>

              {comparison.available && (
                <span
                  className={
                    comparison.change_percent >= 0
                      ? "change-badge positive"
                      : "change-badge negative"
                  }
                >
                  {formatPercent(
                    comparison.change_percent
                  )}
                </span>
              )}
            </div>

            {comparison.available ? (
              <div className="month-comparison">
                <div>
                  <span>
                    {formatMonth(
                      comparison
                        .previous_complete_month
                        ?.date
                    )}
                  </span>

                  <strong>
                    {formatNumber(
                      comparison
                        .previous_complete_month
                        ?.arrivals
                    )}
                  </strong>
                </div>

                <span className="comparison-arrow">
                  →
                </span>

                <div>
                  <span>
                    {formatMonth(
                      comparison
                        .latest_complete_month
                        ?.date
                    )}
                  </span>

                  <strong>
                    {formatNumber(
                      comparison
                        .latest_complete_month
                        ?.arrivals
                    )}
                  </strong>
                </div>
              </div>
            ) : (
              <p className="panel-empty">
                Még nincs elegendő lezárt havi adat
                az összehasonlításhoz.
              </p>
            )}
          </article>
        </section>

        <section className="migration-panel country-arrivals-panel">
          <div className="migration-panel-header">
            <div>
              <p className="panel-eyebrow">
                Belépési országok
              </p>

              <h2>
                Regisztrált érkezések országonként
              </h2>
            </div>

            <div className="country-summary-highlight">
              <span>
                Legaktívabb ország
              </span>

              <strong>
                {countrySummary.top_arrival_country_hu ??
                  "—"}
              </strong>

              <small>
                {formatNumber(
                  countrySummary.top_arrival_country_arrivals
                )}{" "}
                fő
              </small>
            </div>
          </div>

          <div className="country-distribution-layout">
            <div className="country-donut-area">
              <div
                className="country-donut"
                style={{
                  background:
                    countryDonutBackground
                }}
              >
                <div className="country-donut-center">
                  <strong>
                    {formatNumber(
                      countrySummary.country_breakdown_total
                    )}
                  </strong>

                  <span>
                    országos bontás
                  </span>
                </div>
              </div>
            </div>

            <div className="country-distribution-list">
              {countryRows.map((country) => {
                const color =
                  COUNTRY_COLORS[country.country_code] ??
                  "#64748b";

                return (
                  <article
                    className="country-distribution-row"
                    key={country.country_code}
                  >
                    <div className="country-distribution-main">
                      <div className="country-name-line">
                        <span
                          className="country-color-dot"
                          style={{
                            background: color
                          }}
                        />

                        <strong>
                          {country.country_hu}
                        </strong>

                        <span className="country-route">
                          {country.route}
                        </span>
                      </div>

                      <div className="country-distribution-values">
                        <strong>
                          {formatNumber(
                            country.arrivals_ytd
                          )}
                        </strong>

                        <span>
                          {Number.isFinite(
                            country.share_of_regional_total_percent
                          )
                            ? `${country.share_of_regional_total_percent.toLocaleString(
                                "hu-HU"
                              )}%`
                            : "—"}
                        </span>
                      </div>
                    </div>

                    <div className="country-distribution-meta">
                      {Number.isFinite(
                        country.sea_arrivals_ytd
                      ) && (
                        <span>
                          Tengeri{" "}
                          <strong>
                            {formatNumber(
                              country.sea_arrivals_ytd
                            )}
                          </strong>
                        </span>
                      )}

                      {Number.isFinite(
                        country.land_arrivals_ytd
                      ) && (
                        <span>
                          Szárazföldi{" "}
                          <strong>
                            {formatNumber(
                              country.land_arrivals_ytd
                            )}
                          </strong>
                        </span>
                      )}

                      {country.latest_data_date && (
                        <span>
                          Adatdátum{" "}
                          <strong>
                            {formatDate(
                              country.latest_data_date
                            )}
                          </strong>
                        </span>
                      )}

                      {country.latest_month?.people &&
                        !country.latest_data_date && (
                          <span>
                            Aktuális havi adat{" "}
                            <strong>
                              {formatNumber(
                                country.latest_month.people
                              )}
                            </strong>
                          </span>
                        )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="country-coverage-note">
            <span>
              Országos bontás lefedettsége
            </span>

            <strong>
              {Number.isFinite(
                countrySummary.country_breakdown_coverage_percent
              )
                ? `${countrySummary.country_breakdown_coverage_percent.toLocaleString(
                    "hu-HU"
                  )}%`
                : "—"}
            </strong>

            <small>
              a regionális UNHCR összesítéshez viszonyítva
            </small>
          </div>
        </section>

        <section className="migration-panel origin-intelligence-panel">
          <div className="migration-panel-header">
            <div>
              <p className="panel-eyebrow">
                Származási országok
              </p>

              <h2>
                Honnan érkeznek?
              </h2>
            </div>

            <div className="origin-summary-highlight">
              <span>
                Legnagyobb megfigyelt származási ország
              </span>

              <strong>
                {originSummary.top_origin_country ??
                  "—"}
              </strong>

              <small>
                {formatNumber(
                  originSummary.top_origin_observed_people
                )}{" "}
                fő
              </small>
            </div>
          </div>

          <div className="origin-intelligence-layout">
            <div className="origin-ranking-block">
              <div className="origin-section-title">
                Top 5 származási ország
              </div>

              <div className="origin-ranking-list">
                {topOrigins.map((origin, index) => {
                  const width =
                    Math.max(
                      (
                        origin.people /
                        maxOriginValue
                      ) *
                        100,
                      3
                    );

                  const color =
                    ORIGIN_COLORS[
                      index %
                        ORIGIN_COLORS.length
                    ];

                  return (
                    <article
                      className="origin-ranking-row"
                      key={
                        origin.origin_country_code ??
                        origin.origin_country
                      }
                    >
                      <div className="origin-ranking-heading">
                        <div className="origin-ranking-name">
                          <span
                            className="origin-rank-dot"
                            style={{
                              background:
                                color
                            }}
                          />

                          <strong>
                            {index + 1}.{" "}
                            {origin.origin_country}
                          </strong>
                        </div>

                        <div className="origin-ranking-value">
                          <strong>
                            {formatNumber(
                              origin.people
                            )}
                          </strong>

                          <span>
                            {formatNumber(
                              origin.destination_count
                            )}{" "}
                            célország
                          </span>
                        </div>
                      </div>

                      <div className="origin-progress">
                        <span
                          style={{
                            width: `${width}%`,
                            background:
                              color
                          }}
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="movement-intelligence-block">
              <div className="origin-section-title">
                Legerősebb megfigyelt kapcsolat
              </div>

              {strongestMovement ? (
                <div className="movement-card">
                  <div className="movement-flow">
                    <div className="movement-country">
                      <span>
                        Honnan
                      </span>

                      <strong>
                        {strongestMovement.origin_country}
                      </strong>
                    </div>

                    <div className="movement-arrow">
                      →
                    </div>

                    <div className="movement-country">
                      <span>
                        Hová
                      </span>

                      <strong>
                        {strongestMovement.destination_country_hu}
                      </strong>
                    </div>
                  </div>

                  <div className="movement-primary-value">
                    <strong>
                      {formatNumber(
                        strongestMovement.people
                      )}
                    </strong>

                    <span>
                      fő
                    </span>
                  </div>

                  <div className="movement-details">
                    <div>
                      <span>
                        Útvonal
                      </span>

                      <strong>
                        {strongestMovement.route}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Adatdátum
                      </span>

                      <strong>
                        {formatDate(
                          strongestMovement.data_date
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Adatkör
                      </span>

                      <strong>
                        {strongestMovement.scope ===
                        "sea_arrivals"
                          ? "Tengeri érkezések"
                          : strongestMovement.scope ===
                            "sea_and_land_arrivals"
                          ? "Tengeri és szárazföldi"
                          : "Érkezések"}
                      </strong>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="panel-empty">
                  Nincs elérhető mozgási adat.
                </p>
              )}
            </div>
          </div>

          <div className="origin-methodology-note">
            <strong>
              Adatértelmezés:
            </strong>

            <span>
              A származási adatok országonként eltérő
              frissítési dátummal és részben eltérő
              módszertannal jelennek meg. Az összesített
              származási rangsor elemzői összegzés, nem
              hivatalos EU-s UNHCR összesítés.
            </span>
          </div>
        </section>

        <section className="migration-panel migration-trend-panel">
          <div className="migration-panel-header">
            <div>
              <p className="panel-eyebrow">
                2026 havi adatsor
              </p>

              <h2>
                Regisztrált érkezések alakulása
              </h2>
            </div>

            <span className="panel-note">
              Július részleges adat
            </span>
          </div>

          <div className="monthly-chart">
            {monthly.map((item) => {
              const height =
                Math.max(
                  (item.people /
                    maxMonthlyValue) *
                    100,
                  4
                );

              const partial =
                item.date ===
                  latestMonth.date &&
                latestMonth.month_status ===
                  "partial";

              return (
                <div
                  className="monthly-column"
                  key={item.date}
                >
                  <span className="monthly-value">
                    {formatNumber(
                      item.people
                    )}
                  </span>

                  <div className="monthly-bar-track">
                    <div
                      className={`monthly-bar ${
                        partial
                          ? "partial"
                          : ""
                      }`}
                      style={{
                        height: `${height}%`
                      }}
                    />
                  </div>

                  <span className="monthly-label">
                    {new Date(
                      `${item.date}T00:00:00Z`
                    ).toLocaleDateString(
                      "hu-HU",
                      {
                        month: "short",
                        timeZone: "UTC"
                      }
                    )}
                  </span>

                  {partial && (
                    <span className="monthly-partial">
                      részleges
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="migration-footer-status">
          <div>
            <span>
              Adatforrás
            </span>

            <strong>
              UNHCR Europe Sea Arrivals
            </strong>
          </div>

          <div>
            <span>
              Forrásellenőrzés
            </span>

            <strong>
              {status.source_arithmetic_check ===
              "ok"
                ? "Rendben"
                : "Ellenőrzendő"}
            </strong>
          </div>

          <div>
            <span>
              Snapshotok
            </span>

            <strong>
              {formatNumber(
                status.snapshot_count
              )}
            </strong>
          </div>

          <div>
            <span>
              Origin célországok
            </span>

            <strong>
              {formatNumber(
                originSummary.successful_destinations
              )}
              /
              {formatNumber(
                originSummary.configured_destinations
              )}
            </strong>
          </div>
        </section>

      </main>
    </Layout>
  );
}

export default App;
