import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * EU MIGRATION MONITOR
 * UNHCR Europe arrivals collector
 *
 * Cél:
 * - UNHCR Europe Sea Arrivals adatok lekérése
 * - nyers adatok normalizálása
 * - külön JSON fájl létrehozása
 *
 * Fontos:
 * Ez a script egyelőre NEM számol 7 napos értéket.
 * Csak a hivatalosan rendelkezésre álló UNHCR adatokat tárolja.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, "..");

const OUTPUT_DIR = path.join(
  ROOT_DIR,
  "public",
  "data",
  "migration"
);

const OUTPUT_FILE = path.join(
  OUTPUT_DIR,
  "unhcr-arrivals.json"
);

const CURRENT_YEAR = new Date().getUTCFullYear();

/**
 * Az UNHCR Europe Sea Arrivals oldal jelenlegi widgetjei.
 *
 * Population groups:
 * 4797 = sea arrivals
 * 4798 = land arrivals
 * 5634 = további, az Europe Sea Arrivals helyzethez tartozó érkezési kategória
 *
 * A UNHCR jelenlegi Europe Sea Arrivals oldala ezeket együtt használja
 * a teljes éves érkezési mutatóhoz.
 */
const POPULATION_GROUPS = "4797,4798,5634";

const UNHCR_BASE_URL =
  "https://data.unhcr.org/population/get/timeseries";

/**
 * Külön lekérjük:
 * - éves összesítést
 * - havi idősoros adatokat
 *
 * A havi adatok később alkalmasak lesznek trendek és YTD számítására.
 */
const ENDPOINTS = {
  yearly: buildUrl("year"),
  monthly: buildUrl("month")
};

function buildUrl(frequency) {
  const params = new URLSearchParams({
    frequency,
    fromDate: `${CURRENT_YEAR}-01-01`,
    population_group: POPULATION_GROUPS,
    sv_id: "100"
  });

  return `${UNHCR_BASE_URL}?${params.toString()}`;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent":
        "EU-Migration-Monitor/1.0 (+https://github.com/mikloshetzer-sketch/migracio-terkep)"
    },
    signal: AbortSignal.timeout(30000)
  });

  if (!response.ok) {
    throw new Error(
      `UNHCR HTTP hiba: ${response.status} ${response.statusText}`
    );
  }

  const text = await response.text();

  if (!text.trim()) {
    throw new Error("Az UNHCR üres választ adott.");
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(
      `Az UNHCR válasza nem érvényes JSON: ${error.message}`
    );
  }
}

/**
 * Az UNHCR válaszformátuma változhat.
 * Ezért nem feltételezzük, hogy mindig ugyanazon a kulcson
 * található az adatsor.
 */
function findDataArray(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const preferredKeys = [
    "data",
    "results",
    "result",
    "timeseries",
    "series",
    "population"
  ];

  for (const key of preferredKeys) {
    if (Array.isArray(payload[key])) {
      return payload[key];
    }
  }

  for (const value of Object.values(payload)) {
    if (Array.isArray(value)) {
      return value;
    }

    if (value && typeof value === "object") {
      const nested = findDataArray(value);

      if (nested.length > 0) {
        return nested;
      }
    }
  }

  return [];
}

function firstDefined(object, keys) {
  if (!object || typeof object !== "object") {
    return null;
  }

  for (const key of keys) {
    if (
      object[key] !== undefined &&
      object[key] !== null &&
      object[key] !== ""
    ) {
      return object[key];
    }
  }

  return null;
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const cleaned = String(value)
    .replace(/\s/g, "")
    .replace(/,/g, "")
    .trim();

  const number = Number(cleaned);

  return Number.isFinite(number) ? number : null;
}

function normaliseDate(value) {
  if (!value) {
    return null;
  }

  const raw = String(value).trim();

  const directMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (directMatch) {
    return `${directMatch[1]}-${directMatch[2]}-${directMatch[3]}`;
  }

  const monthMatch = raw.match(/^(\d{4})-(\d{2})$/);

  if (monthMatch) {
    return `${monthMatch[1]}-${monthMatch[2]}-01`;
  }

  const parsed = new Date(raw);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

function normaliseRecord(record, granularity) {
  const dateRaw = firstDefined(record, [
    "date",
    "period",
    "month",
    "year",
    "x",
    "name"
  ]);

  const peopleRaw = firstDefined(record, [
    "value",
    "total",
    "population",
    "individuals",
    "people",
    "count",
    "y"
  ]);

  const people = parseNumber(peopleRaw);

  if (people === null) {
    return null;
  }

  const date = normaliseDate(dateRaw);

  return {
    date,
    year:
      date?.slice(0, 4) ??
      String(
        firstDefined(record, ["year"]) ??
          CURRENT_YEAR
      ),
    granularity,
    people,
    arrival_country:
      firstDefined(record, [
        "geo_name",
        "country",
        "country_name",
        "location"
      ]) ?? null,
    arrival_country_code:
      firstDefined(record, [
        "geo_code",
        "country_code",
        "iso3",
        "iso"
      ]) ?? null,
    arrival_type:
      firstDefined(record, [
        "population_group_name",
        "type",
        "category"
      ]) ?? "arrival",
    data_type: "arrival",
    source: "UNHCR",
    source_dataset: "Europe Sea Arrivals"
  };
}

function normalisePayload(payload, granularity) {
  const records = findDataArray(payload);

  return records
    .map((record) =>
      normaliseRecord(record, granularity)
    )
    .filter(Boolean);
}

function sumPeople(records) {
  return records.reduce(
    (sum, record) =>
      sum +
      (Number.isFinite(record.people)
        ? record.people
        : 0),
    0
  );
}

function getLatestDate(records) {
  const dates = records
    .map((record) => record.date)
    .filter(Boolean)
    .sort();

  return dates.at(-1) ?? null;
}

function deduplicate(records) {
  const map = new Map();

  for (const record of records) {
    const key = [
      record.date,
      record.arrival_country_code,
      record.arrival_country,
      record.arrival_type,
      record.granularity,
      record.people
    ].join("|");

    map.set(key, record);
  }

  return [...map.values()];
}

async function main() {
  console.log("==========================================");
  console.log("EU MIGRATION MONITOR");
  console.log("UNHCR arrivals update");
  console.log("==========================================");

  console.log(
    `Év: ${CURRENT_YEAR}`
  );

  await fs.mkdir(OUTPUT_DIR, {
    recursive: true
  });

  console.log(
    "UNHCR éves adatok lekérése..."
  );

  const yearlyRaw = await fetchJson(
    ENDPOINTS.yearly
  );

  console.log(
    "UNHCR havi adatok lekérése..."
  );

  const monthlyRaw = await fetchJson(
    ENDPOINTS.monthly
  );

  const yearlyRecords = normalisePayload(
    yearlyRaw,
    "yearly"
  );

  const monthlyRecords = normalisePayload(
    monthlyRaw,
    "monthly"
  );

  const allRecords = deduplicate([
    ...yearlyRecords,
    ...monthlyRecords
  ]);

  /**
   * Havi adatok alapján számolt YTD.
   *
   * Ez csak akkor kerül használatra,
   * ha tényleges havi rekordokat kaptunk.
   */
  const monthlyYtd = sumPeople(
    monthlyRecords.filter((record) =>
      record.year === String(CURRENT_YEAR)
    )
  );

  /**
   * Éves rekordból származó hivatalos érték.
   */
  const yearlyYtd = sumPeople(
    yearlyRecords.filter((record) =>
      record.year === String(CURRENT_YEAR)
    )
  );

  const ytd =
    yearlyYtd > 0
      ? yearlyYtd
      : monthlyYtd;

  const output = {
    metadata: {
      dataset:
        "EU Migration Monitor - UNHCR arrivals",
      source: "UNHCR",
      source_name:
        "Europe Sea Arrivals",
      source_url:
        "https://data.unhcr.org/en/situations/europe-sea-arrivals",
      generated_at:
        new Date().toISOString(),
      year: CURRENT_YEAR,
      coverage: [
        "Italy",
        "Malta",
        "Cyprus",
        "Greece",
        "Spain"
      ],
      definition:
        "Registered sea and land arrivals reported in the UNHCR Europe Sea Arrivals dataset.",
      important_note:
        "These data do not represent all migration into the European Union and must not be combined with asylum applications or Frontex detections as if they were identical measures."
    },

    summary: {
      year: CURRENT_YEAR,
      arrivals_ytd: ytd,
      latest_available_date:
        getLatestDate(allRecords),
      yearly_records:
        yearlyRecords.length,
      monthly_records:
        monthlyRecords.length,
      seven_day_arrivals: null,
      thirty_day_arrivals: null,
      seven_day_status:
        "not_available_from_monthly_data",
      thirty_day_status:
        "not_calculated_yet"
    },

    records: allRecords,

    raw_debug: {
      yearly_response_type:
        Array.isArray(yearlyRaw)
          ? "array"
          : typeof yearlyRaw,
      monthly_response_type:
        Array.isArray(monthlyRaw)
          ? "array"
          : typeof monthlyRaw
    }
  };

  await fs.writeFile(
    OUTPUT_FILE,
    JSON.stringify(output, null, 2),
    "utf8"
  );

  console.log("------------------------------------------");
  console.log(
    `Éves érkezések: ${ytd.toLocaleString("hu-HU")} fő`
  );
  console.log(
    `Havi rekordok: ${monthlyRecords.length}`
  );
  console.log(
    `Éves rekordok: ${yearlyRecords.length}`
  );
  console.log(
    `Kimenet: ${OUTPUT_FILE}`
  );
  console.log("------------------------------------------");
  console.log(
    "UNHCR frissítés sikeresen befejezve."
  );
}

main().catch((error) => {
  console.error("");
  console.error(
    "UNHCR adatfrissítési hiba:"
  );
  console.error(error);

  process.exitCode = 1;
});
