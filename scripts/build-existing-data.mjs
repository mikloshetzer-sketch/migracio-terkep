import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();

const INPUT_ROUTES = path.join(ROOT, "data", "routes_2025.json");
const OUTPUT_DIR = path.join(ROOT, "public", "data", "derived");

const countryCoords = {
  AF: [67.71, 33.94],
  DE: [10.4515, 51.1657],
  ES: [-3.7492, 40.4637],
  GR: [21.8243, 39.0742],
  IT: [12.5674, 41.8719],
  LY: [17.2283, 26.3351],
  MA: [-7.0926, 31.7917],
  SY: [38.9968, 34.8021],
  TR: [35.2433, 38.9637]
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

function labelFromRisk(risk) {
  const labels = {
    critical: "Critical",
    high: "High",
    elevated: "Elevated",
    moderate: "Moderate",
    low: "Low"
  };

  return labels[risk] || "Unknown";
}

function lineFromRoute(route) {
  const from = countryCoords[route.from];
  const to = countryCoords[route.to];

  if (!from || !to) return null;

  const pressure = pressureFromCount(route.count);
  const risk = riskFromPressure(pressure);

  return {
    type: "Feature",
    properties: {
      path: route.path,
      from: route.from,
      to: route.to,
      count: route.count,
      pressure,
      risk
    },
    geometry: {
      type: "LineString",
      coordinates: [from, to]
    }
  };
}

function hotspotFromRoute(route) {
  const from = countryCoords[route.from];

  if (!from) return null;

  const pressure = pressureFromCount(route.count);
  const risk = riskFromPressure(pressure);

  return {
    type: "Feature",
    properties: {
      name: `${route.path} origin`,
      path: route.path,
      country: route.from,
      count: route.count,
      pressure,
      risk,
      level: labelFromRisk(risk),
      type: "origin_pressure"
    },
    geometry: {
      type: "Point",
      coordinates: from
    }
  };
}

function destinationHotspotFromRoute(route) {
  const to = countryCoords[route.to];

  if (!to) return null;

  const pressure = pressureFromCount(route.count);
  const risk = riskFromPressure(pressure);

  return {
    type: "Feature",
    properties: {
      name: `${route.path} destination`,
      path: route.path,
      country: route.to,
      count: route.count,
      pressure,
      risk,
      level: labelFromRisk(risk),
      type: "destination_pressure"
    },
    geometry: {
      type: "Point",
      coordinates: to
    }
  };
}

function groupHotspots(features) {
  const grouped = new Map();

  for (const feature of features) {
    if (!feature) continue;

    const key = feature.properties.country;
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, feature);
      continue;
    }

    existing.properties.count += feature.properties.count;
    existing.properties.pressure = Math.max(
      existing.properties.pressure,
      feature.properties.pressure
    );

    existing.properties.risk = riskFromPressure(existing.properties.pressure);
    existing.properties.level = labelFromRisk(existing.properties.risk);
    existing.properties.name = `${key} migration pressure`;
  }

  return Array.from(grouped.values());
}

async function main() {
  const raw = await fs.readFile(INPUT_ROUTES, "utf8");
  const data = JSON.parse(raw);

  const routes = Array.isArray(data.routes) ? data.routes : [];

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const corridorFeatures = routes.map(lineFromRoute).filter(Boolean);

  const rawHotspots = [
    ...routes.map(hotspotFromRoute),
    ...routes.map(destinationHotspotFromRoute)
  ].filter(Boolean);

  const hotspotFeatures = groupHotspots(rawHotspots);

  const pressureIndex = routes.map((route) => {
    const pressure = pressureFromCount(route.count);
    const risk = riskFromPressure(pressure);

    return {
      path: route.path,
      from: route.from,
      to: route.to,
      count: route.count,
      pressure,
      risk,
      level: labelFromRisk(risk)
    };
  });

  const corridors = {
    type: "FeatureCollection",
    generated_at: new Date().toISOString(),
    source: "data/routes_2025.json",
    features: corridorFeatures
  };

  const hotspots = {
    type: "FeatureCollection",
    generated_at: new Date().toISOString(),
    source: "data/routes_2025.json",
    features: hotspotFeatures
  };

  await fs.writeFile(
    path.join(OUTPUT_DIR, "corridors.geojson"),
    JSON.stringify(corridors, null, 2),
    "utf8"
  );

  await fs.writeFile(
    path.join(OUTPUT_DIR, "hotspots.geojson"),
    JSON.stringify(hotspots, null, 2),
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

  console.log(`Generated ${corridorFeatures.length} corridors`);
  console.log(`Generated ${hotspotFeatures.length} hotspots`);
  console.log(`Generated ${pressureIndex.length} pressure index records`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
