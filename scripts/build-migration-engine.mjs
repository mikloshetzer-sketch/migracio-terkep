import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();

async function loadJson(file) {
  const content = await fs.readFile(file, "utf8");
  return JSON.parse(content);
}

async function saveJson(file, data) {
  await fs.writeFile(
    file,
    JSON.stringify(data, null, 2),
    "utf8"
  );
}

function calculatePressure(route) {

  const migrants = route.migrants || 0;

  if (migrants > 300000) return 100;

  if (migrants > 200000) return 80;

  if (migrants > 100000) return 60;

  if (migrants > 50000) return 40;

  return 20;
}

async function main() {

  const routes = await loadJson(
    path.join(ROOT, "data", "routes_2025.json")
  );

  const arrivals = await loadJson(
    path.join(ROOT, "data", "arrivals_2025.json")
  );

  const pressureIndex = [];

  const hotspots = [];

  for (const route of routes) {

    const pressure = calculatePressure(route);

    pressureIndex.push({

      route: route.name,

      pressure

    });

    hotspots.push({

      name: route.name,

      pressure,

      coordinates: route.coordinates || []

    });

  }

  await fs.mkdir(

    path.join(ROOT, "public", "data"),

    { recursive: true }

  );

  await saveJson(

    path.join(
      ROOT,
      "public",
      "data",
      "pressure-index.json"
    ),

    pressureIndex

  );

  await saveJson(

    path.join(
      ROOT,
      "public",
      "data",
      "hotspots-generated.json"
    ),

    hotspots

  );

  console.log(

    `Generated ${hotspots.length} hotspots`

  );

}

main().catch((error) => {

  console.error(error);

  process.exit(1);

});
