import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "public", "data", "official");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "euaa.json");

const SOURCES = {
  overview: "https://www.euaa.europa.eu/latest-asylum-trends-monthly-overview",
  applications:
    "https://www.euaa.europa.eu/latest-asylum-trends-monthly-overview/applications",
  recognitionRates:
    "https://www.euaa.europa.eu/latest-asylum-trends-monthly-overview/recognition-rates",
  pendingCases:
    "https://www.euaa.europa.eu/latest-asylum-trends-monthly-overview/pending-cases",
  annexes:
    "https://www.euaa.europa.eu/latest-asylum-trends-monthly-overview/annexes"
};

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&minus;/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeNumber(value) {
  if (!value) return null;

  const cleaned = String(value)
    .replace(/\s/g, "")
    .replace(/,/g, "")
    .replace(/\./g, "");

  const number = Number(cleaned);

  return Number.isFinite(number) ? number : null;
}

function findFirstNumber(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      return normalizeNumber(match[1]);
    }
  }

  return null;
}

function findFirstPercent(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      return Number(match[1]);
    }
  }

  return null;
}

function findTrendPercent(text, keyword) {
  const lower = text.toLowerCase();
  const index = lower.indexOf(keyword.toLowerCase());

  if (index === -1) return null;

  const window = text.slice(index, index + 500);

  const decrease = window.match(/(?:fell|decreased|down|decline|declined).*?([0-9]+)%/i);
  if (decrease?.[1]) return Number(decrease[1]) * -1;

  const increase = window.match(/(?:increased|rose|up).*?([0-9]+)%/i);
  if (increase?.[1]) return Number(increase[1]);

  return null;
}

async function fetchPage(url) {
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

    return {
      url,
      ok: response.ok,
      status: response.status,
      text: response.ok ? htmlToText(body) : "",
      error: response.ok ? null : `HTTP ${response.status}`
    };
  } catch (error) {
    return {
      url,
      ok: false,
      status: "fetch_error",
      text: "",
      error: String(error.message || error)
    };
  } finally {
    clearTimeout(timeout);
  }
}

function extractMetrics(pages) {
  const combinedText = pages.map((page) => page.text).join(" ");

  const applicationsText =
    pages.find((page) => page.url === SOURCES.applications)?.text || combinedText;

  const recognitionText =
    pages.find((page) => page.url === SOURCES.recognitionRates)?.text || combinedText;

  const pendingText =
    pages.find((page) => page.url === SOURCES.pendingCases)?.text || combinedText;

  const applications_last_12_months = findFirstNumber(applicationsText, [
    /over the last 12 months[^0-9]*([0-9][0-9\s,.]*)\s+applications/i,
    /([0-9][0-9\s,.]*)\s+applications[^.]{0,120}last 12 months/i
  ]);

  const recognition_rate_pct = findFirstPercent(recognitionText, [
    /recognition rate[^0-9]*([0-9]+)%/i,
    /EU\+\s+recognition rate[^0-9]*([0-9]+)%/i
  ]);

  const pending_cases = findFirstNumber(pendingText, [
    /([0-9][0-9\s,.]*)\s+pending cases/i,
    /pending cases[^0-9]*([0-9][0-9\s,.]*)/i
  ]);

  return {
    applications_last_12_months,
    recognition_rate_pct,
    pending_cases,
    trend_indicators: {
      afghan_applications_pct: findTrendPercent(applicationsText, "Afghan applications"),
      syrian_applications_pct: findTrendPercent(applicationsText, "Syrian applications"),
      turkish_applications_pct: findTrendPercent(applicationsText, "Turks"),
      ukrainian_applications_pct: findTrendPercent(applicationsText, "Ukrainians")
    }
  };
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const pages = await Promise.all(
    Object.values(SOURCES).map((url) => fetchPage(url))
  );

  const metrics = extractMetrics(pages);

  const payload = {
    generated_at: new Date().toISOString(),
    status: pages.some((page) => page.ok) ? "ok" : "source_error",
    source: "EUAA",
    source_type: "official",
    update_frequency: "monthly",
    data_scope:
      "EU+ asylum applications, first-instance decisions, recognition rates and pending cases based on EUAA Latest Asylum Trends pages.",
    warning:
      "EUAA trend figures are provisional analytical indicators and may differ from validated Eurostat statistics.",
    sources: SOURCES,
    fetch_results: pages.map((page) => ({
      url: page.url,
      ok: page.ok,
      status: page.status,
      error: page.error
    })),
    metrics
  };

  await fs.writeFile(
    OUTPUT_FILE,
    JSON.stringify(payload, null, 2),
    "utf8"
  );

  console.log(`EUAA data written: ${OUTPUT_FILE}`);
  console.log(`Status: ${payload.status}`);
}

main().catch(async (error) => {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const fallback = {
    generated_at: new Date().toISOString(),
    status: "script_error",
    source: "EUAA",
    source_type: "official",
    error: String(error.message || error),
    metrics: {}
  };

  await fs.writeFile(
    OUTPUT_FILE,
    JSON.stringify(fallback, null, 2),
    "utf8"
  );

  console.error(error);
  process.exit(0);
});
