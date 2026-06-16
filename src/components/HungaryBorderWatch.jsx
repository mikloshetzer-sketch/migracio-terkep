import React from "react";

const borderData = [
  {
    country: "Serbia",
    level: "High",
    score: 78
  },
  {
    country: "Romania",
    level: "Low",
    score: 28
  },
  {
    country: "Croatia",
    level: "Moderate",
    score: 42
  },
  {
    country: "Ukraine",
    level: "Low",
    score: 22
  }
];

function HungaryBorderWatch() {
  return (
    <section className="routes-section">

      <div className="panel-header">

        <div>

          <p className="eyebrow">

            Hungary Border Watch

          </p>

          <h2>

            Border pressure monitoring

          </h2>

        </div>

      </div>

      <div className="route-list">

        {borderData.map((item) => (

          <article
            className="route-card"
            key={item.country}
          >

            <div>

              <h3>{item.country}</h3>

              <p>

                Current border pressure indicator

              </p>

            </div>

            <div className="route-score">

              <strong>{item.score}</strong>

              <span>{item.level}</span>

            </div>

          </article>

        ))}

      </div>

    </section>
  );
}

export default HungaryBorderWatch;
