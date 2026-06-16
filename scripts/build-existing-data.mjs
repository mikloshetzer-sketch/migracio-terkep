import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();

const INPUT_ROUTES = path.join(ROOT, "data", "routes_2025.json");
const OUTPUT_DIR = path.join(ROOT, "public", "data", "derived");

const countryCoords = {
  SY: [38.9968, 34.8021],
  GR: [21.8243, 39.0742],
  TR: [35.2433, 38.9637],
  LY: [17.2283, 26.3351],
  IT: [12.5674, 41.8719],
  MA: [-7.0926, 31.7917],
  ES: [-3.7492, 40.4637],
  AF: [67.71, 33.94],
  DE: [10.4515, 51.1657]
};

function pressureFromCount(count) {
  if (count >= 120000) return 90;
  if (count >= 95000) return 80;
  if (count >= 70000) return 70;
  if (count >= 40000) return 55;
  return 35;
}

function riskFromPressure(score) {
  if (score >= 85) return "critical";
  if (score >= 70) return "high";
  if (score >= 55) return "elevated";
  if (score >= 40) return "moderate";
  return "low";
}

function lineFromRoute(route) {
  const from = countryCoords[route.from];
  const to = countryCoords[route.to];

  if (!from || !to) return null;

  return {
    type: "Feature",
    properties: {
      path: route.path,
      from: route.from,
      to: route.to,
      count: route.count,
      pressure: pressureFromCount(route.count),
      risk: riskFromPressure(pressureFromCount(route.count))
    },
    geometry: {
      type: "LineString",
      coordinates: [from, to]
    }
  };
}

async function main() {
  const raw = await fs.readFile(INPUT_ROUTES, "utf8");
  const data = JSON.parse(raw);

  const routes = Array.isArray(data.routes) ? data.routes : [];

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const corridors = {
    type: "FeatureCollection",
    generated_at: new Date().toISOString(),
    source: "data/routes_2025.json",
    features: routes.map(lineFromRoute).filter(Boolean)
  };

  const pressureIndex = routes.map((route) => {
    const pressure = pressureFromCount(route.count);

    return {
      path: route.path,
      from: route.from,
      to: route.to,
      count: route.count,
      pressure,
      risk: riskFromPressure(pressure)
    };
  });

  await fs.writeFile(
    path.join(OUTPUT_DIR, "corridors.geojson"),
    JSON.stringify(corridors, null, 2),
    "utf8"
  );

  await fs.writeFile(
    path.join(OUTPUT_DIR, "pressure-index.json"),
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        source: "data/routes_2025.json",
        items: pressureIndex
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(`Generated ${corridors.features.length} corridors`);
  console.log(`Generated ${pressureIndex.length} pressure index records`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
