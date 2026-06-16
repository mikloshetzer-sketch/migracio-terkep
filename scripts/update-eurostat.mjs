import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "public", "data", "official");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "eurostat.json");

const EUROSTAT_BASE =
  "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data";

const DATASETS = {
  asylum_applications_monthly: {
    code: "migr_asyappctzm",
    description:
      "Monthly asylum applicants by citizenship, age, sex and reporting country."
  }
};

const EU_REPORTING_COUNTRIES = [
  "AT",
  "BE",
  "BG",
  "CY",
  "CZ",
  "DE",
  "DK",
  "EE",
  "EL",
  "ES",
  "FI",
  "FR",
  "HR",
  "HU",
  "IE",
  "IT",
  "LT",
  "LU",
  "LV",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SE",
  "SI",
  "SK"
];

function buildUrl(datasetCode, params = {}) {
  const url = new URL(`${EUROSTAT_BASE}/${datasetCode}`);

  url.searchParams.set("format", "JSON");
  url.searchParams.set("lang", "en");

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        url.searchParams.append(key, item);
      }
    } else if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "EMIC-Migration-Intelligence-Center/1.0"
      }
    });

    const text = await response.text();

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: text.slice(0, 500),
        data: null
      };
    }

    return {
      ok: true,
      status: response.status,
      error: null,
      data: JSON.parse(text)
    };
  } catch (error) {
    return {
      ok: false,
      status: "fetch_error",
      error: String(error.message || error),
      data: null
    };
  } finally {
    clearTimeout(timeout);
  }
}

function getDimensionCategoryIndex(dataset, dimensionName, code) {
  const dimension = dataset.dimension?.[dimensionName];

  if (!dimension?.category?.index) return null;

  const index = dimension.category.index[code];

  return Number.isInteger(index) ? index : null;
}

function getTimeLabels(dataset) {
  const timeIndex = dataset.dimension?.time?.category?.index || {};
  return Object.entries(timeIndex)
    .sort((a, b) => a[1] - b[1])
    .map(([label]) => label);
}

function getValueByDimensionCodes(dataset, dimensionCodes) {
  const ids = dataset.id || [];
  const sizes = dataset.size || [];

  let flatIndex = 0;

  for (let i = 0; i < ids.length; i += 1) {
    const dimensionName = ids[i];
    const code = dimensionCodes[dimensionName];

    const categoryIndex = getDimensionCategoryIndex(
      dataset,
      dimensionName,
      code
    );

    if (categoryIndex === null) return null;

    const multiplier = sizes.slice(i + 1).reduce((acc, value) => acc * value, 1);
    flatIndex += categoryIndex * multiplier;
  }

  const value = dataset.value?.[flatIndex];

  return Number.isFinite(value) ? value : null;
}

function extractCountryTotals(dataset) {
  const timeLabels = getTimeLabels(dataset);

  if (!timeLabels.length) {
    return {
      latest_period: null,
      totals_by_country: {},
      eu_total: null
    };
  }

  const latestPeriod = timeLabels[timeLabels.length - 1];
  const totalsByCountry = {};
  let euTotal = 0;

  for (const country of EU_REPORTING_COUNTRIES) {
    const value = getValueByDimensionCodes(dataset, {
      freq: "M",
      citizen: "TOTAL",
      sex: "T",
      age: "TOTAL",
      unit: "NR",
      geo: country,
      time: latestPeriod
    });

    totalsByCountry[country === "EL" ? "GR" : country] = value || 0;
    euTotal += value || 0;
  }

  return {
    latest_period: latestPeriod,
    totals_by_country: totalsByCountry,
    eu_total: euTotal
  };
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const asylumUrl = buildUrl(DATASETS.asylum_applications_monthly.code, {
    freq: "M",
    citizen: "TOTAL",
    sex: "T",
    age: "TOTAL",
    unit: "NR",
    geo: EU_REPORTING_COUNTRIES
  });

  const asylumResult = await fetchJson(asylumUrl);

  const asylumSummary = asylumResult.ok
    ? extractCountryTotals(asylumResult.data)
    : {
        latest_period: null,
        totals_by_country: {},
        eu_total: null
      };

  const payload = {
    generated_at: new Date().toISOString(),
    status: asylumResult.ok ? "ok" : "source_error",
    source: "Eurostat",
    source_type: "official",
    update_frequency: "monthly / quarterly / annual depending on dataset",
    datasets: DATASETS,
    warning:
      "Eurostat figures are validated statistical data and may lag behind operational sources such as Frontex or EUAA.",
    fetch_results: {
      asylum_applications_monthly: {
        ok: asylumResult.ok,
        status: asylumResult.status,
        error: asylumResult.error,
        url: asylumUrl
      }
    },
    asylum_applications_monthly: asylumSummary
  };

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(payload, null, 2), "utf8");

  console.log(`Eurostat data written: ${OUTPUT_FILE}`);
  console.log(`Status: ${payload.status}`);
  console.log(
    `Latest period: ${payload.asylum_applications_monthly.latest_period}`
  );
}

main().catch(async (error) => {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const fallback = {
    generated_at: new Date().toISOString(),
    status: "script_error",
    source: "Eurostat",
    source_type: "official",
    error: String(error.message || error),
    asylum_applications_monthly: {
      latest_period: null,
      totals_by_country: {},
      eu_total: null
    }
  };

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(fallback, null, 2), "utf8");

  console.error(error);
  process.exit(0);
});
