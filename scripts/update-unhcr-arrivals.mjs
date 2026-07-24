import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * ============================================================
 * EU MIGRATION MONITOR
 * UNHCR ARRIVALS C:contentReference[oaicite:0]{index=0}===================================================
 *
 * Forrás:
 * UNHCR Europe Sea Arrivals
 *
 * Kimenet:
 * public/data/migration/unhcr-arrivals.json
 *
 * FONTOS:
 * - havi UNHCR-adatokat használunk
 * - nem becsülünk 7 napos adatot havi adatokból
 * - az YTD érték a 2026-os havi rekordok összege
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

const UNHCR_API =
  "https://data.unhcr.org/population/get/timeseries";

/**
 * ------------------------------------------------------------
 * UNHCR CONFIG
 * ------------------------------------------------------------
 *
 * Population groups:
 *
 * 4797 = Sea arrivals
 * 4798 = Land arrivals
 * 5634 = Additional sea-arrival category
 *
 * A UNHCR Europe Sea Arrivals főoldala ugyanezt a három
 * kategóriát használja a teljes arrivals mutatóhoz.
 */

const POPULATION_GROUPS =
  "4797,4798,5634";

/**
 * A havi lekérés már az első verziónál működött:
 * 7 havi rekordot adott vissza.
 *
 * A probléma akkor kizárólag a hónapok értelmezése volt.
 */
const MONTHLY_WIDGET_ID =
  "686750";

/**
 * A UNHCR jelenlegi Total arrivals in 2026 widgetje.
 * Ezt kontrollértékként kérjük le.
 */
const ANNUAL_WIDGET_ID =
  "686755";

/**
 * ------------------------------------------------------------
 * URL BUILDERS
 * ------------------------------------------------------------
 */

function buildMonthlyUrl() {
  const params = new URLSearchParams({
    frequency: "month",
    fromDate: `${CURRENT_YEAR}-01-01`,
    population_group: POPULATION_GROUPS,
    sv_id: "100",
    widget_id: MONTHLY_WIDGET_ID
  });

  return `${UNHCR_API}?${params.toString()}`;
}

function buildAnnualUrl() {
  const params = new URLSearchParams({
    frequency: "year",
    fromDate: `${CURRENT_YEAR}-01-01`,
    population_group: POPULATION_GROUPS,
    sv_id: "100",
    widget_id: ANNUAL_WIDGET_ID
  });

  return `${UNHCR_API}?${params.toString()}`;
}

/**
 * ------------------------------------------------------------
 * FETCH
 * ------------------------------------------------------------
 */

async function fetchJson(url) {
  console.log(`Lekérés: ${url}`);

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent":
        "EU-Migration-Monitor/3.0 (+https://github.com/mikloshetzer-sketch/migracio-terkep)"
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
      `Az UNHCR válasza nem JSON: ${error.message}`
    );
  }
}

/**
 * ------------------------------------------------------------
 * ARRAY FINDER
 * ------------------------------------------------------------
 */

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

/**
 * ------------------------------------------------------------
 * HELPERS
 * ------------------------------------------------------------
 */

function firstDefined(
  object,
  keys
) {
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

/**
 * ------------------------------------------------------------
 * MONTH PARSER
 * ------------------------------------------------------------
 *
 * EZ JAVÍTJA A KORÁBBI 2001-ES HIBÁT.
 *
 * Az UNHCR például:
 *
 * 01
 * 02
 * 03
 *
 * formában is visszaadhatja a hónapot.
 *
 * Ezeket most:
 *
 * 2026-01-01
 * 2026-02-01
 * 2026-03-01
 *
 * formára alakítjuk.
 */

function parseMonth(rawValue) {
  if (
    rawValue === null ||
    rawValue === undefined
  ) {
    return null;
  }

  const value =
    String(rawValue).trim();

  /**
   * 1 / 01 / 12
   */

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
          `${CURRENT_YEAR}-${String(
            month
          ).padStart(2, "0")}-01`
      };
    }
  }

  /**
   * 2026-01
   */

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
          `${year}-${String(
            month
          ).padStart(2, "0")}-01`
      };
    }
  }

  /**
   * 2026-01-01
   */

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
          `${year}-${String(
            month
          ).padStart(2, "0")}-01`
      };
    }
  }

  /**
   * Hónapnevek
   */

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
        `${CURRENT_YEAR}-${String(
          month
        ).padStart(2, "0")}-01`
    };
  }

  return null;
}

/**
 * ------------------------------------------------------------
 * MONTHLY RECORD NORMALISATION
 * ------------------------------------------------------------
 */

function normaliseMonthlyRecord(
  record
) {
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

    people,

    granularity:
      "monthly",

    data_type:
      "arrival",

    arrival_type:
      "sea_and_land",

    source:
      "UNHCR",

    source_dataset:
      "Europe Sea Arrivals"
  };
}

/**
 * ------------------------------------------------------------
 * ANNUAL RECORD PARSER
 * ------------------------------------------------------------
 */

function normaliseAnnualRecord(
  record
) {
  if (
    !record ||
    typeof record !== "object"
  ) {
    return null;
  }

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

  const people =
    parseNumber(rawValue);

  if (
    people === null ||
    people < 0
  ) {
    return null;
  }

  return {
    year: CURRENT_YEAR,
    people
  };
}

/**
 * ------------------------------------------------------------
 * DEDUPLICATION
 * ------------------------------------------------------------
 */

function deduplicateMonthly(
  records
) {
  const map =
    new Map();

  for (const record of records) {
    /**
     * Egy hónaphoz egy aggregált érték kell.
     */

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

/**
 * ------------------------------------------------------------
 * SUM
 * ------------------------------------------------------------
 */

function sumPeople(records) {
  return records.reduce(
    (sum, record) =>
      sum + record.people,
    0
  );
}

/**
 * ------------------------------------------------------------
 * VALIDATION
 * ------------------------------------------------------------
 */

function validateMonthly(
  records
) {
  if (!records.length) {
    throw new Error(
      "Nem érkezett feldolgozható havi UNHCR adat."
    );
  }

  for (const record of records) {
    if (
      record.year !==
      CURRENT_YEAR
    ) {
      throw new Error(
        `Hibás év: ${record.year}`
      );
    }

    if (
      record.month < 1 ||
      record.month > 12
    ) {
      throw new Error(
        `Hibás hónap: ${record.month}`
      );
    }

    if (
      !record.date.startsWith(
        String(CURRENT_YEAR)
      )
    ) {
      throw new Error(
        `Hibás dátum: ${record.date}`
      );
    }

    if (
      !Number.isFinite(
        record.people
      ) ||
      record.people < 0
    ) {
      throw new Error(
        `Hibás érkezésszám: ${record.people}`
      );
    }
  }
}

/**
 * ------------------------------------------------------------
 * MAIN
 * ------------------------------------------------------------
 */

async function main() {
  console.log(
    "=========================================="
  );

  console.log(
    "EU MIGRATION MONITOR"
  );

  console.log(
    "UNHCR arrivals update v3"
  );

  console.log(
    "=========================================="
  );

  console.log(
    `Év: ${CURRENT_YEAR}`
  );

  await fs.mkdir(
    OUTPUT_DIR,
    {
      recursive: true
    }
  );

  /**
   * ==========================================================
   * MONTHLY DATA
   * ==========================================================
   */

  console.log("");
  console.log(
    "Havi UNHCR adatok lekérése..."
  );

  const monthlyRaw =
    await fetchJson(
      buildMonthlyUrl()
    );

  const monthlyRawArray =
    findDataArray(
      monthlyRaw
    );

  console.log(
    `Nyers havi rekordok: ${monthlyRawArray.length}`
  );

  if (
    monthlyRawArray.length > 0
  ) {
    console.log("");
    console.log(
      "Első nyers havi rekord:"
    );

    console.log(
      JSON.stringify(
        monthlyRawArray[0],
        null,
        2
      )
    );
  }

  const monthlyRecords =
    deduplicateMonthly(
      monthlyRawArray
        .map(
          normaliseMonthlyRecord
        )
        .filter(Boolean)
    );

  validateMonthly(
    monthlyRecords
  );

  /**
   * ==========================================================
   * YTD FROM MONTHS
   * ==========================================================
   */

  const arrivalsYtd =
    sumPeople(
      monthlyRecords
    );

  const latestRecord =
    monthlyRecords.at(-1);

  /**
   * ==========================================================
   * ANNUAL CONTROL VALUE
   * ==========================================================
   */

  console.log("");
  console.log(
    "Éves UNHCR kontrolladat lekérése..."
  );

  let annualControl = null;

  try {
    const annualRaw =
      await fetchJson(
        buildAnnualUrl()
      );

    const annualArray =
      findDataArray(
        annualRaw
      );

    console.log(
      `Nyers éves rekordok: ${annualArray.length}`
    );

    if (
      annualArray.length > 0
    ) {
      console.log("");
      console.log(
        "Első nyers éves rekord:"
      );

      console.log(
        JSON.stringify(
          annualArray[0],
          null,
          2
        )
      );

      annualControl =
        normaliseAnnualRecord(
          annualArray[0]
        );
    }
  } catch (error) {
    /**
     * A havi adatok ettől még használhatók.
     */

    console.warn(
      "Az éves kontrollérték nem volt lekérhető:"
    );

    console.warn(
      error.message
    );
  }

  /**
   * ==========================================================
   * OUTPUT
   * ==========================================================
   */

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

      population_groups: [
        4797,
        4798,
        5634
      ],

      definition:
        "Registered sea and land arrivals reported in the UNHCR Europe Sea Arrivals dataset.",

      important_note:
        "The dataset covers UNHCR Mediterranean and related arrival reporting and is not equivalent to all migration into the European Union.",

      methodology:
        "The year-to-date value is calculated as the sum of the available monthly UNHCR arrival records. Weekly values are not estimated from monthly data."
    },

    summary: {
      year:
        CURRENT_YEAR,

      arrivals_ytd:
        arrivalsYtd,

      latest_available_month:
        latestRecord?.date ??
        null,

      latest_month_arrivals:
        latestRecord?.people ??
        null,

      monthly_records:
        monthlyRecords.length,

      annual_control_value:
        annualControl?.people ??
        null,

      annual_control_difference:
        annualControl
          ? arrivalsYtd -
            annualControl.people
          : null,

      seven_day_arrivals:
        null,

      thirty_day_arrivals:
        null,

      seven_day_status:
        "requires_daily_or_event_level_data",

      thirty_day_status:
        "requires_daily_or_event_level_data"
    },

    monthly:
      monthlyRecords,

    diagnostics: {
      monthly_raw_records:
        monthlyRawArray.length,

      annual_control_available:
        annualControl !== null,

      monthly_widget_id:
        MONTHLY_WIDGET_ID,

      annual_widget_id:
        ANNUAL_WIDGET_ID
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

  /**
   * ==========================================================
   * CONSOLE RESULT
   * ==========================================================
   */

  console.log("");
  console.log(
    "=========================================="
  );

  console.log(
    "EREDMÉNY"
  );

  console.log(
    "=========================================="
  );

  console.log(
    `2026 YTD: ${arrivalsYtd.toLocaleString(
      "hu-HU"
    )} fő`
  );

  console.log(
    `Havi rekordok: ${monthlyRecords.length}`
  );

  console.log(
    `Legfrissebb hónap: ${latestRecord?.date ?? "nincs"}`
  );

  console.log(
    `Legfrissebb havi érték: ${
      latestRecord
        ? latestRecord.people.toLocaleString(
            "hu-HU"
          )
        : "nincs"
    } fő`
  );

  if (annualControl) {
    console.log(
      `Éves UNHCR kontrollérték: ${annualControl.people.toLocaleString(
        "hu-HU"
      )} fő`
    );

    console.log(
      `Eltérés: ${(
        arrivalsYtd -
        annualControl.people
      ).toLocaleString(
        "hu-HU"
      )} fő`
    );
  }

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
