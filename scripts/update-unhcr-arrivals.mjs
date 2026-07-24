import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

const UNHCR_API =
  "https://data.unhcr.org/population/get/timeseries";

const DATASETS = {
  total: {
    key: "total",
    label: "Sea and land arrivals",
    populationGroup: "4797,4798,5634",
    widgetId: "686750"
  },

  sea: {
    key: "sea",
    label: "Sea arrivals",
    populationGroup: "4797,5634",
    widgetId: "686751"
  },

  land: {
    key: "land",
    label: "Land arrivals",
    populationGroup: "4798",
    widgetId: "686752"
  }
};

function buildUrl(dataset) {
  const params = new URLSearchParams({
    frequency: "month",
    fromDate: `${CURRENT_YEAR}-01-01`,
    population_group: dataset.populationGroup,
    sv_id: "100",
    widget_id: dataset.widgetId
  });

  return `${UNHCR_API}?${params.toString()}`;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent":
        "EU-Migration-Monitor/4.1 (+https://github.com/mikloshetzer-sketch/migracio-terkep)"
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
    throw new Error(
      "Az UNHCR üres választ adott."
    );
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

  if (
    !payload ||
    typeof payload !== "object"
  ) {
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

  let bestArray = [];

  for (const value of Object.values(payload)) {
    if (Array.isArray(value)) {
      if (value.length > bestArray.length) {
        bestArray = value;
      }

      continue;
    }

    if (
      value &&
      typeof value === "object"
    ) {
      const nested =
        findDataArray(value);

      if (
        nested.length >
        bestArray.length
      ) {
        bestArray = nested;
      }
    }
  }

  return bestArray;
}

function firstDefined(object, keys) {
  if (
    !object ||
    typeof object !== "object"
  ) {
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

function parseMonth(rawValue) {
  if (
    rawValue === null ||
    rawValue === undefined
  ) {
    return null;
  }

  const value =
    String(rawValue).trim();

  if (/^\d{1,2}$/.test(value)) {
    const month =
      Number(value);

    if (
      month >= 1 &&
      month <= 12
    ) {
      return {
        year: CURRENT_YEAR,
        month,
        date:
          `${CURRENT_YEAR}-${String(month).padStart(
            2,
            "0"
          )}-01`
      };
    }
  }

  let match =
    value.match(
      /^(\d{4})-(\d{1,2})$/
    );

  if (match) {
    const year =
      Number(match[1]);

    const month =
      Number(match[2]);

    if (
      year === CURRENT_YEAR &&
      month >= 1 &&
      month <= 12
    ) {
      return {
        year,
        month,
        date:
          `${year}-${String(month).padStart(
            2,
            "0"
          )}-01`
      };
    }
  }

  match =
    value.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})/
    );

  if (match) {
    const year =
      Number(match[1]);

    const month =
      Number(match[2]);

    if (
      year === CURRENT_YEAR &&
      month >= 1 &&
      month <= 12
    ) {
      return {
        year,
        month,
        date:
          `${year}-${String(month).padStart(
            2,
            "0"
          )}-01`
      };
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
    december: 12,

    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    oct: 10,
    nov: 11,
    dec: 12
  };

  const lower =
    value.toLowerCase();

  if (monthNames[lower]) {
    const month =
      monthNames[lower];

    return {
      year: CURRENT_YEAR,
      month,
      date:
        `${CURRENT_YEAR}-${String(month).padStart(
          2,
          "0"
        )}-01`
    };
  }

  return null;
}

function normaliseRecord(record) {
  if (
    !record ||
    typeof record !== "object"
  ) {
    return null;
  }

  const rawPeriod =
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

  const rawValue =
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

  const parsedDate =
    parseMonth(rawPeriod);

  const people =
    parseNumber(rawValue);

  if (!parsedDate) {
    return null;
  }

  if (
    people === null ||
    people < 0
  ) {
    return null;
  }

  return {
    date:
      parsedDate.date,

    year:
      parsedDate.year,

    month:
      parsedDate.month,

    people
  };
}

function normaliseDataset(payload) {
  const rawRecords =
    findDataArray(payload);

  const map =
    new Map();

  for (const rawRecord of rawRecords) {
    const record =
      normaliseRecord(rawRecord);

    if (!record) {
      continue;
    }

    map.set(
      record.date,
      record
    );
  }

  return [...map.values()]
    .sort(
      (a, b) =>
        a.date.localeCompare(
          b.date
        )
    );
}

function sumPeople(records) {
  return records.reduce(
    (sum, record) =>
      sum + record.people,
    0
  );
}

function mergeMonthly(
  totalRecords,
  seaRecords,
  landRecords
) {
  const months =
    new Map();

  for (const record of totalRecords) {
    months.set(
      record.date,
      {
        date:
          record.date,

        year:
          record.year,

        month:
          record.month,

        people:
          record.people,

        sea_arrivals:
          null,

        land_arrivals:
          null,

        calculation_difference:
          null,

        granularity:
          "monthly",

        data_type:
          "arrival",

        source:
          "UNHCR",

        source_dataset:
          "Europe Sea Arrivals"
      }
    );
  }

  for (const record of seaRecords) {
    if (!months.has(record.date)) {
      continue;
    }

    months.get(
      record.date
    ).sea_arrivals =
      record.people;
  }

  for (const record of landRecords) {
    if (!months.has(record.date)) {
      continue;
    }

    months.get(
      record.date
    ).land_arrivals =
      record.people;
  }

  for (const month of months.values()) {
    if (
      Number.isFinite(
        month.sea_arrivals
      ) &&
      Number.isFinite(
        month.land_arrivals
      )
    ) {
      month.calculation_difference =
        month.people -
        (
          month.sea_arrivals +
          month.land_arrivals
        );
    }
  }

  return [...months.values()]
    .sort(
      (a, b) =>
        a.date.localeCompare(
          b.date
        )
    );
}

function validateRecords(
  records,
  label
) {
  if (!records.length) {
    throw new Error(
      `${label}: nincs feldolgozható UNHCR adat.`
    );
  }

  for (const record of records) {
    if (
      record.year !==
      CURRENT_YEAR
    ) {
      throw new Error(
        `${label}: hibás év: ${record.year}`
      );
    }

    if (
      record.month < 1 ||
      record.month > 12
    ) {
      throw new Error(
        `${label}: hibás hónap: ${record.month}`
      );
    }

    if (
      !Number.isFinite(
        record.people
      ) ||
      record.people < 0
    ) {
      throw new Error(
        `${label}: hibás érkezésszám.`
      );
    }
  }
}

async function downloadDataset(
  dataset
) {
  console.log("");
  console.log(
    `${dataset.label} lekérése...`
  );

  const url =
    buildUrl(dataset);

  const raw =
    await fetchJson(url);

  const rawArray =
    findDataArray(raw);

  console.log(
    `Nyers rekordok: ${rawArray.length}`
  );

  const records =
    normaliseDataset(raw);

  console.log(
    `2026-os havi rekordok: ${records.length}`
  );

  validateRecords(
    records,
    dataset.label
  );

  console.log(
    `${dataset.label} YTD: ${sumPeople(
      records
    ).toLocaleString(
      "hu-HU"
    )} fő`
  );

  return {
    url,
    rawRecords:
      rawArray.length,
    records
  };
}

async function main() {
  console.log(
    "=========================================="
  );

  console.log(
    "EU MIGRATION MONITOR"
  );

  console.log(
    "UNHCR arrivals update v4.1"
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

  const totalData =
    await downloadDataset(
      DATASETS.total
    );

  const seaData =
    await downloadDataset(
      DATASETS.sea
    );

  const landData =
    await downloadDataset(
      DATASETS.land
    );

  const arrivalsYtd =
    sumPeople(
      totalData.records
    );

  const seaArrivalsYtd =
    sumPeople(
      seaData.records
    );

  const landArrivalsYtd =
    sumPeople(
      landData.records
    );

  const monthly =
    mergeMonthly(
      totalData.records,
      seaData.records,
      landData.records
    );

  const latestRecord =
    monthly.at(-1);

  const calculatedYtd =
    seaArrivalsYtd +
    landArrivalsYtd;

  const ytdDifference =
    arrivalsYtd -
    calculatedYtd;

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

      methodology:
        "Total, sea and land arrivals are downloaded separately from the official UNHCR monthly datasets and cross-checked.",

      important_note:
        "These figures describe the UNHCR Europe Sea Arrivals reporting area and must not be interpreted as all migration into the European Union."
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

      calculated_ytd:
        calculatedYtd,

      ytd_difference:
        ytdDifference,

      latest_available_month:
        latestRecord?.date ??
        null,

      latest_month_arrivals:
        latestRecord?.people ??
        null,

      latest_month_sea_arrivals:
        latestRecord?.sea_arrivals ??
        null,

      latest_month_land_arrivals:
        latestRecord?.land_arrivals ??
        null,

      monthly_records:
        monthly.length,

      seven_day_arrivals:
        null,

      thirty_day_arrivals:
        null,

      seven_day_status:
        "requires_daily_or_event_level_data",

      thirty_day_status:
        "requires_daily_or_event_level_data"
    },

    monthly,

    diagnostics: {
      total: {
        widget_id:
          DATASETS.total.widgetId,

        raw_records:
          totalData.rawRecords,

        valid_2026_records:
          totalData.records.length
      },

      sea: {
        widget_id:
          DATASETS.sea.widgetId,

        raw_records:
          seaData.rawRecords,

        valid_2026_records:
          seaData.records.length
      },

      land: {
        widget_id:
          DATASETS.land.widgetId,

        raw_records:
          landData.rawRecords,

        valid_2026_records:
          landData.records.length
      },

      arithmetic_check: {
        total_ytd:
          arrivalsYtd,

        sea_plus_land_ytd:
          calculatedYtd,

        difference:
          ytdDifference,

        status:
          ytdDifference === 0
            ? "ok"
            : "difference_detected"
      }
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
    "=========================================="
  );

  console.log(
    "UNHCR EREDMÉNY"
  );

  console.log(
    "=========================================="
  );

  console.log(
    `Összes érkezés YTD: ${arrivalsYtd.toLocaleString(
      "hu-HU"
    )} fő`
  );

  console.log(
    `Tengeri érkezés YTD: ${seaArrivalsYtd.toLocaleString(
      "hu-HU"
    )} fő`
  );

  console.log(
    `Szárazföldi érkezés YTD: ${landArrivalsYtd.toLocaleString(
      "hu-HU"
    )} fő`
  );

  console.log(
    `Sea + Land: ${calculatedYtd.toLocaleString(
      "hu-HU"
    )} fő`
  );

  console.log(
    `Eltérés: ${ytdDifference.toLocaleString(
      "hu-HU"
    )} fő`
  );

  console.log(
    `Havi rekordok: ${monthly.length}`
  );

  console.log(
    `Legfrissebb hónap: ${latestRecord?.date ?? "nincs adat"}`
  );

  console.log(
    `Kimenet: ${OUTPUT_FILE}`
  );

  console.log(
    "=========================================="
  );

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
