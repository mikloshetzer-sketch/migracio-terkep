import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * ============================================================
 * EU MIGRATION MONITOR
 * UNHCR Europe Arrivals Collector
 * ============================================================
 *
 * Kimenet:
 * public/data/migration/unhcr-arrivals.json
 *
 * FONTOS:
 * - nem becsül heti adatot havi adatokból
 * - a UNHCR population groupokat külön kérdezi le
 * - csak az aktuális év rekordjait engedi be
 * ============================================================
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

const UNHCR_BASE_URL =
  "https://data.unhcr.org/population/get/timeseries";

/**
 * UNHCR population groupok.
 */
const POPULATION_GROUPS = [
  {
    id: 4797,
    apiValue: "0;4797",
    label: "Sea arrivals",
    arrivalType: "sea"
  },
  {
    id: 4798,
    apiValue: "0;4798",
    label: "Land arrivals",
    arrivalType: "land"
  },
  {
    id: 5634,
    apiValue: "0;5634",
    label: "Additional sea arrivals",
    arrivalType: "sea"
  }
];

function buildUrl(group) {
  const params = new URLSearchParams({
    frequency: "month",
    fromDate: `${CURRENT_YEAR}-01-01`,
    population_group: group.apiValue,
    sv_id: "100",
    geo_id: "0"
  });

  return `${UNHCR_BASE_URL}?${params.toString()}`;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent":
        "EU-Migration-Monitor/2.0 (+https://github.com/mikloshetzer-sketch/migracio-terkep)"
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
    "population",
    "chartData"
  ];

  for (const key of preferredKeys) {
    if (Array.isArray(payload[key])) {
      return payload[key];
    }
  }

  for (const value of Object.values(payload)) {
    if (value && typeof value === "object") {
      const result = findDataArray(value);

      if (result.length > 0) {
        return result;
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
    const value = object[key];

    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      return value;
    }
  }

  return null;
}

function parseNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? Math.round(value)
      : null;
  }

  const cleaned = String(value)
    .replace(/\s/g, "")
    .replace(/,/g, "")
    .trim();

  const number = Number(cleaned);

  return Number.isFinite(number)
    ? Math.round(number)
    : null;
}

/**
 * A hónapot biztonságosan az aktuális évhez köti.
 *
 * Példák:
 * "01"      -> 2026-01-01
 * "7"       -> 2026-07-01
 * "2026-07" -> 2026-07-01
 */
function normaliseMonthDate(rawDate, rawYear = null) {
  if (
    rawDate === null ||
    rawDate === undefined
  ) {
    return null;
  }

  const value = String(rawDate).trim();

  const explicitYear =
    rawYear !== null &&
    rawYear !== undefined &&
    rawYear !== ""
      ? Number(rawYear)
      : CURRENT_YEAR;

  if (/^\d{1,2}$/.test(value)) {
    const month = Number(value);

    if (
      month >= 1 &&
      month <= 12 &&
      explicitYear === CURRENT_YEAR
    ) {
      return `${CURRENT_YEAR}-${String(month).padStart(
        2,
        "0"
      )}-01`;
    }
  }

  const yearMonthMatch =
    value.match(/^(\d{4})-(\d{1,2})$/);

  if (yearMonthMatch) {
    const year = Number(yearMonthMatch[1]);
    const month = Number(yearMonthMatch[2]);

    if (
      year === CURRENT_YEAR &&
      month >= 1 &&
      month <= 12
    ) {
      return `${year}-${String(month).padStart(
        2,
        "0"
      )}-01`;
    }
  }

  const fullDateMatch =
    value.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})/
    );

  if (fullDateMatch) {
    const year = Number(fullDateMatch[1]);
    const month = Number(fullDateMatch[2]);

    if (
      year === CURRENT_YEAR &&
      month >= 1 &&
      month <= 12
    ) {
      return `${year}-${String(month).padStart(
        2,
        "0"
      )}-01`;
    }
  }

  const monthNames = {
    january: 1,
    february: 2,
    march: 3,
    april: 4,
    may: 5,
    june: 6,
    july: 7,
    august: 8,
    september: 9,
    october: 10,
    november: 11,
    december: 12
  };

  const lowerValue = value.toLowerCase();

  if (
    monthNames[lowerValue] &&
    explicitYear === CURRENT_YEAR
  ) {
    const month = monthNames[lowerValue];

    return `${CURRENT_YEAR}-${String(month).padStart(
      2,
      "0"
    )}-01`;
  }

  return null;
}

function normaliseRecord(record, group) {
  if (!record || typeof record !== "object") {
    return null;
  }

  const rawYear =
    firstDefined(record, [
      "year",
      "Year",
      "YEAR"
    ]);

  const rawDate =
    firstDefined(record, [
      "month",
      "Month",
      "MONTH",
      "date",
      "Date",
      "period",
      "Period",
      "x",
      "name",
      "category"
    ]);

  const rawPeople =
    firstDefined(record, [
      "value",
      "Value",
      "VALUE",
      "total",
      "Total",
      "population",
      "Population",
      "individuals",
      "people",
      "count",
      "y"
    ]);

  const people = parseNumber(rawPeople);

  if (
    people === null ||
    people < 0
  ) {
    return null;
  }

  const date =
    normaliseMonthDate(
      rawDate,
      rawYear
    );

  if (!date) {
    return null;
  }

  const recordYear =
    Number(date.slice(0, 4));

  const recordMonth =
    Number(date.slice(5, 7));

  if (recordYear !== CURRENT_YEAR) {
    return null;
  }

  return {
    date,
    year: recordYear,
    month: recordMonth,
    granularity: "monthly",
    people,

    arrival_country: null,
    arrival_country_code: null,

    population_group: group.id,
    population_group_name: group.label,

    arrival_type: group.arrivalType,
    data_type: "arrival",

    source: "UNHCR",
    source_dataset:
      "Europe Sea Arrivals"
  };
}

function normaliseGroupPayload(
  payload,
  group
) {
  const records =
    findDataArray(payload);

  return records
    .map((record) =>
      normaliseRecord(record, group)
    )
    .filter(Boolean);
}

function aggregateMonthly(records) {
  const months = new Map();

  for (const record of records) {
    const key = record.date;

    if (!months.has(key)) {
      months.set(key, {
        date: key,
        year: record.year,
        month: record.month,
        granularity: "monthly",

        people: 0,
        sea_arrivals: 0,
        land_arrivals: 0,

        data_type: "arrival",
        source: "UNHCR",
        source_dataset:
          "Europe Sea Arrivals"
      });
    }

    const month =
      months.get(key);

    month.people +=
      record.people;

    if (
      record.arrival_type === "sea"
    ) {
      month.sea_arrivals +=
        record.people;
    }

    if (
      record.arrival_type === "land"
    ) {
      month.land_arrivals +=
        record.people;
    }
  }

  return [...months.values()]
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date)
    );
}

function sumField(records, field) {
  return records.reduce(
    (sum, record) => {
      const value =
        Number(record[field]);

      return sum +
        (Number.isFinite(value)
          ? value
          : 0);
    },
    0
  );
}

function latestAvailableDate(records) {
  if (!records.length) {
    return null;
  }

  return records
    .map((record) => record.date)
    .filter(Boolean)
    .sort()
    .at(-1);
}

function validateMonthlyRecords(records) {
  for (const record of records) {
    if (record.year !== CURRENT_YEAR) {
      throw new Error(
        `Érvénytelen év az UNHCR adatban: ${record.year}`
      );
    }

    if (
      record.month < 1 ||
      record.month > 12
    ) {
      throw new Error(
        `Érvénytelen hónap az UNHCR adatban: ${record.month}`
      );
    }

    if (
      !Number.isFinite(record.people) ||
      record.people < 0
    ) {
      throw new Error(
        `Érvénytelen érkezésszám: ${record.people}`
      );
    }
  }
}

async function main() {
  console.log(
    "=========================================="
  );

  console.log(
    "EU MIGRATION MONITOR"
  );

  console.log(
    "UNHCR arrivals update v2"
  );

  console.log(
    "=========================================="
  );

  console.log(
    `Aktuális év: ${CURRENT_YEAR}`
  );

  await fs.mkdir(
    OUTPUT_DIR,
    {
      recursive: true
    }
  );

  const allDetailedRecords = [];
  const groupDiagnostics = [];

  for (const group of POPULATION_GROUPS) {
    console.log("");
    console.log(
      `${group.label} lekérése...`
    );

    const url =
      buildUrl(group);

    const raw =
      await fetchJson(url);

    const rawArray =
      findDataArray(raw);

    console.log(
      `API nyers rekordok: ${rawArray.length}`
    );

    if (rawArray.length > 0) {
      console.log(
        "Első nyers rekord:"
      );

      console.log(
        JSON.stringify(
          rawArray[0],
          null,
          2
        )
      );
    }

    const records =
      normaliseGroupPayload(
        raw,
        group
      );

    console.log(
      `${group.label}: ${records.length} érvényes havi rekord`
    );

    allDetailedRecords.push(
      ...records
    );

    groupDiagnostics.push({
      population_group:
        group.id,

      label:
        group.label,

      raw_records:
        rawArray.length,

      valid_records:
        records.length,

      total:
        sumField(
          records,
          "people"
        )
    });
  }

  validateMonthlyRecords(
    allDetailedRecords
  );

  const monthlyRecords =
    aggregateMonthly(
      allDetailedRecords
    );

  validateMonthlyRecords(
    monthlyRecords
  );

  const arrivalsYtd =
    sumField(
      monthlyRecords,
      "people"
    );

  const seaArrivalsYtd =
    sumField(
      monthlyRecords,
      "sea_arrivals"
    );

  const landArrivalsYtd =
    sumField(
      monthlyRecords,
      "land_arrivals"
    );

  const latestDate =
    latestAvailableDate(
      monthlyRecords
    );

  const output = {
    metadata: {
      dataset:
        "EU Migration Monitor - UNHCR arrivals",

      source:
        "UNHCR",

      source_name:
        "Europe Sea Arrivals",

      source_url:
        "https://data.unhcr.org/en/situations/europe-sea-arrivals",

      generated_at:
        new Date().toISOString(),

      year:
        CURRENT_YEAR,

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
        "These data do not represent all migration into the European Union and must not be combined with asylum applications or Frontex detections as if they were identical measures.",

      methodology:
        "UNHCR arrival population groups are downloaded separately and aggregated by calendar month."
    },

    summary: {
      year:
        CURRENT_YEAR,

      arrivals_ytd:
        arrivalsYtd,

      sea_arrivals_ytd:
        seaArrivalsYtd,

      land_arrivals_ytd:
        landArrivalsYtd,

      latest_available_date:
        latestDate,

      monthly_records:
        monthlyRecords.length,

      detailed_records:
        allDetailedRecords.length,

      seven_day_arrivals:
        null,

      thirty_day_arrivals:
        null,

      seven_day_status:
        "not_available_from_monthly_data",

      thirty_day_status:
        "not_calculated_from_monthly_data"
    },

    monthly:
      monthlyRecords,

    detailed_records:
      allDetailedRecords,

    diagnostics: {
      population_groups:
        groupDiagnostics
    }
  };

  await fs.writeFile(
    OUTPUT_FILE,
    JSON.stringify(
      output,
      null,
      2
    ),
    "utf8"
  );

  console.log("");
  console.log(
    "------------------------------------------"
  );

  console.log(
    `UNHCR YTD összesen: ${arrivalsYtd.toLocaleString(
      "hu-HU"
    )} fő`
  );

  console.log(
    `Tengeri érkezések: ${seaArrivalsYtd.toLocaleString(
      "hu-HU"
    )} fő`
  );

  console.log(
    `Szárazföldi érkezések: ${landArrivalsYtd.toLocaleString(
      "hu-HU"
    )} fő`
  );

  console.log(
    `Havi rekordok: ${monthlyRecords.length}`
  );

  console.log(
    `Legfrissebb hónap: ${latestDate ?? "nincs adat"}`
  );

  console.log(
    `Kimenet: ${OUTPUT_FILE}`
  );

  console.log(
    "------------------------------------------"
  );

  if (monthlyRecords.length === 0) {
    throw new Error(
      "Az UNHCR API-ból nem sikerült érvényes havi adatot előállítani."
    );
  }

  if (arrivalsYtd === 0) {
    throw new Error(
      "Az UNHCR YTD összesítés 0 lett."
    );
  }

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
