import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "public", "data", "official");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "frontex.json");

const SOURCES = {
  migratoryMap:
    "https://www.frontex.europa.eu/what-we-do/monitoring-and-risk-analysis/migratory-map/",
  migratoryRoutes:
    "https://www.frontex.europa.eu/what-we-do/monitoring-and-risk-analysis/migratory-routes/migratory-routes/",
  latestNews:
    "https://www.frontex.europa.eu/media-centre/news/news-release/frontex-irregular-border-crossings-into-the-eu-down-40-in-the-first-four-months-of-2026-MwZAin"
};

const ROUTES = [
  {
    id: "WESTERN_AFRICA",
    name: "Western African Route",
    corridor_group: "Atlantic / Canary Islands",
    priority: 4
  },
  {
    id: "WESTERN_MEDITERRANEAN",
    name: "Western Mediterranean Route",
    corridor_group: "North Africa to Spain",
    priority: 4
  },
  {
    id: "CENTRAL_MEDITERRANEAN",
    name: "Central Mediterranean Route",
    corridor_group: "Libya / Tunisia to Italy / Malta",
    priority: 5
  },
  {
    id: "EASTERN_MEDITERRANEAN",
    name: "Eastern Mediterranean Route",
    corridor_group: "Türkiye to Greece / Cyprus / Balkans",
    priority: 5
  },
  {
    id: "WESTERN_BALKANS",
    name: "Western Balkan Route",
    corridor_group: "Serbia / Bosnia / North Macedonia to Hungary / Croatia",
    priority: 5
  },
  {
    id: "EASTERN_BORDERS",
    name: "Eastern Borders Route",
    corridor_group: "Belarus / Russia / Ukraine border pressure",
    priority: 4
  },
  {
    id: "ENGLISH_CHANNEL",
    name: "English Channel Route",
    corridor_group: "France to United Kingdom",
    priority: 3
  }
];

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeNumber(value) {
  if (!value) return null;

  const cleaned = String(value)
    .replace(/\s/g, "")
    .replace(",", "")
    .replace(".", "");

  const number = Number(cleaned);

  return Number.isFinite(number) ? number : null;
}

function findNumberNear(text, phrases) {
  const lower = text.toLowerCase();

  for (const phrase of phrases) {
    const index = lower.indexOf(phrase.toLowerCase());

    if (index === -1) continue;

    const window = text.slice(index, index + 500);

    const match =
      window.match(/around\s+([0-9][0-9\s,.]*)/i) ||
      window.match(/over\s+([0-9][0-9\s,.]*)/i) ||
      window.match(/just over\s+([0-9][0-9\s,.]*)/i) ||
      window.match(/([0-9][0-9\s,.]*)\s+(crossings|arrivals|detections)/i);

    if (match) {
      return normalizeNumber(match[1]);
    }
  }

  return null;
}

function findPercentNear(text, phrases) {
  const lower = text.toLowerCase();

  for (const phrase of phrases) {
    const index = lower.indexOf(phrase.toLowerCase());

    if (index === -1) continue;

    const window = text.slice(index, index + 500);
    const match = window.match(/down\s+by\s+([0-9]+)%/i);

    if (match) {
      return Number(match[1]) * -1;
    }

    const rise = window.match(/up\s+by\s+([0-9]+)%/i);

    if (rise) {
      return Number(rise[1]);
    }
  }

  return null;
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "EMIC-Migration-Intelligence-Center/1.0"
      }
    });

    const body = await response.text();

    if (!response.ok) {
      return {
        ok: false,
        url,
        status: response.status,
        text: ""
      };
    }

    return {
      ok: true,
      url,
      status: response.status,
      text: htmlToText(body)
    };
  } catch (error) {
    return {
      ok: false,
      url,
      status: "fetch_error",
      text: "",
      error: String(error.message || error)
    };
  } finally {
    clearTimeout(timeout);
  }
}

function buildRouteRecords(newsText) {
  const totalDetections = findNumberNear(newsText, [
    "first four months of 2026",
    "crossings were recorded"
  ]);

  return ROUTES.map((route) => {
    let detected_value = null;
    let change_yoy_pct = null;

    if (route.id === "CENTRAL_MEDITERRANEAN") {
      detected_value = findNumberNear(newsText, [
        "Central Mediterranean was the busiest route",
        "Central Mediterranean"
      ]);

      change_yoy_pct = findPercentNear(newsText, [
        "Central Mediterranean was the busiest route",
        "Central Mediterranean"
      ]);
    }

    if (route.id === "WESTERN_AFRICA") {
      change_yoy_pct = findPercentNear(newsText, [
        "Western African route",
        "Western Africa"
      ]);
    }

    return {
      ...route,
      detected_value,
      change_yoy_pct,
      unit: "detections",
      source_note:
        "Frontex data refer to detections of irregular or illegal border crossings, not unique persons."
    };
  }).map((route) => ({
    ...route,
    total_context_detections: totalDetections
  }));
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const fetched = await Promise.all([
    fetchText(SOURCES.migratoryMap),
    fetchText(SOURCES.migratoryRoutes),
    fetchText(SOURCES.latestNews)
  ]);

  const news = fetched.find((item) => item.url === SOURCES.latestNews);
  const newsText = news?.text || "";

  const routes = buildRouteRecords(newsText);

  const payload = {
    generated_at: new Date().toISOString(),
    status: fetched.some((item) => item.ok) ? "ok" : "source_error",
    source: "Frontex",
    source_type: "official",
    update_frequency: "monthly",
    unit: "detections",
    warning:
      "Frontex figures are detections of illegal or irregular border-crossings, not the number of unique persons.",
    sources: SOURCES,
    fetch_results: fetched.map((item) => ({
      url: item.url,
      ok: item.ok,
      status: item.status,
      error: item.error || null
    })),
    routes
  };

  await fs.writeFile(
    OUTPUT_FILE,
    JSON.stringify(payload, null, 2),
    "utf8"
  );

  console.log(`Frontex data written: ${OUTPUT_FILE}`);
  console.log(`Routes prepared: ${routes.length}`);
  console.log(`Status: ${payload.status}`);
}

main().catch(async (error) => {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const fallback = {
    generated_at: new Date().toISOString(),
    status: "script_error",
    source: "Frontex",
    source_type: "official",
    unit: "detections",
    error: String(error.message || error),
    routes: ROUTES
  };

  await fs.writeFile(
    OUTPUT_FILE,
    JSON.stringify(fallback, null, 2),
    "utf8"
  );

  console.error(error);
  process.exit(0);
});
