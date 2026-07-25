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
  "country-arrivals.json"
);

const CURRENT_YEAR = new Date().getUTCFullYear();

const UNHCR_API =
  "https://data.unhcr.org/population/get/timeseries";

const COUNTRIES = [
  {
    key: "italy",
    name: "Italy",
    name_hu: "Olaszország",
    code: "IT",
    route: "Central Mediterranean",
    geo_id: "656",
    population_group: "4797",
    widget_id: "690058",
    use_adm_root_level_data: false
  },
  {
    key: "greece",
    name: "Greece",
    name_hu: "Görögország",
    code: "GR",
    route: "Eastern Mediterranean",
    geo_id: "24489",
    population_group: "4797,4798",
    widget_id: "688675",
    use_adm_root_level_data: true
  },
  {
    key: "spain",
    name: "Spain",
    name_hu: "Spanyolország",
    code: "ES",
    route:
      "Western Mediterranean / West African Atlantic",
    geo_id: "729",
    population_group: "4797,4798,5634",
    widget_id: "687069",
    use_adm_root_level_data: false
  },
  {
    key: "cyprus",
    name: "Cyprus",
    name_hu: "Ciprus",
    code: "CY",
    route: "Eastern Mediterranean",
    geo_id: "24473",
    population_group: "4797,4798",
    widget_id: "663857",
    use_adm_root_level_data: true
  }
];

function buildUrl(country) {
  const params = new URLSearchParams({
    frequency: "month",
    fromDate: `${CURRENT_YEAR}-01-01`,
    geo_id: country.geo_id,
    population_group:
      country.population_group,
    sv_id: "100",
    widget_id: country.widget_id
  });

  if (
    country.use_adm_root_level_data
  ) {
    params.set(
      "useAdmRootLevelData",
      "1"
    );
  }

  return `${UNHCR_API}?${params.toString()}`;
}

async function fetchJson(url) {
  const response = await fetch(
    url,
    {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "EU-Migration-Monitor/1.1"
      },
      signal:
        AbortSignal.timeout(
          30000
        )
    }
  );

  if (!response.ok) {
    throw new Error(
      `UNHCR HTTP hiba: ${response.status} ${response.statusText}`
    );
  }

  const text =
    await response.text();

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

function findTimeseries(payload) {
  if (
    Array.isArray(
      payload?.data?.timeseries
    )
  ) {
    return payload.data.timeseries;
  }

  if (
    Array.isArray(
      payload?.timeseries
    )
  ) {
    return payload.timeseries;
  }

  if (
    Array.isArray(
      payload?.data
    )
  ) {
    return payload.data;
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  return [];
}

function parseNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number = Number(
    String(value)
      .replace(/\s/g, "")
      .replace(/,/g, "")
  );

  return Number.isFinite(number)
    ? Math.round(number)
    : null;
}

function normaliseRecord(record) {
  if (
    !record ||
    typeof record !== "object"
  ) {
    return null;
  }

  const year =
    Number(record.year);

  const month =
    Number(record.month);

  const people =
    parseNumber(
      record.individuals ??
      record.people ??
      record.value ??
      record.total
    );

  if (
    year !== CURRENT_YEAR ||
    month < 1 ||
    month > 12 ||
    people === null ||
    people < 0
  ) {
    return null;
  }

  return {
    date:
      `${year}-${String(
        month
      ).padStart(
        2,
        "0"
      )}-01`,

    year,
    month,
    people
  };
}

function normaliseRecords(payload) {
  const rawRecords =
    findTimeseries(payload);

  const map =
    new Map();

  for (
    const rawRecord
    of rawRecords
  ) {
    const record =
      normaliseRecord(
        rawRecord
      );

    if (!record) {
      continue;
    }

    map.set(
      record.date,
      record
    );
  }

  return [
    ...map.values()
  ].sort(
    (a, b) =>
      a.date.localeCompare(
        b.date
      )
  );
}

function sumPeople(records) {
  return records.reduce(
    (sum, record) =>
      sum +
      record.people,
    0
  );
}

function calculateShare(
  value,
  total
) {
  if (
    !Number.isFinite(value) ||
    !Number.isFinite(total) ||
    total <= 0
  ) {
    return null;
  }

  return Number(
    (
      value /
      total *
      100
    ).toFixed(2)
  );
}

async function loadRegionalTotal() {
  const file = path.join(
    OUTPUT_DIR,
    "unhcr-arrivals.json"
  );

  try {
    const text =
      await fs.readFile(
        file,
        "utf8"
      );

    const data =
      JSON.parse(text);

    const total =
      data?.summary
        ?.arrivals_ytd;

    return Number.isFinite(
      total
    )
      ? total
      : null;
  } catch {
    return null;
  }
}

async function downloadCountry(
  country
) {
  console.log("");
  console.log(
    `${country.name_hu} lekérése...`
  );

  const url =
    buildUrl(country);

  console.log(
    `Widget: ${country.widget_id}`
  );

  console.log(
    `Geo ID: ${country.geo_id}`
  );

  console.log(
    `URL: ${url}`
  );

  const payload =
    await fetchJson(url);

  const rawRecords =
    findTimeseries(
      payload
    );

  console.log(
    `Nyers rekordok: ${rawRecords.length}`
  );

  const records =
    normaliseRecords(
      payload
    );

  if (
    records.length === 0
  ) {
    console.warn(
      `${country.name_hu}: nem érkezett feldolgozható ${CURRENT_YEAR}-os havi adat.`
    );

    return {
      country,
      url,
      raw_records:
        rawRecords.length,
      records: [],
      arrivals_ytd: null,
      latest_month: null,
      status: "no_data"
    };
  }

  const arrivalsYtd =
    sumPeople(records);

  const latestMonth =
    records.at(-1);

  console.log(
    `${country.name_hu}: ${records.length} havi rekord`
  );

  console.log(
    `${country.name_hu} YTD: ${arrivalsYtd.toLocaleString(
      "hu-HU"
    )} fő`
  );

  return {
    country,
    url,
    raw_records:
      rawRecords.length,
    records,
    arrivals_ytd:
      arrivalsYtd,
    latest_month:
      latestMonth,
    status: "ok"
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
    "Country arrivals update v1.1"
  );

  console.log(
    "=========================================="
  );

  await fs.mkdir(
    OUTPUT_DIR,
    {
      recursive: true
    }
  );

  const regionalTotal =
    await loadRegionalTotal();

  const results = [];

  for (
    const country
    of COUNTRIES
  ) {
    const result =
      await downloadCountry(
        country
      );

    results.push(result);
  }

  const validCountries =
    results.filter(
      (item) =>
        Number.isFinite(
          item.arrivals_ytd
        )
    );

  const countriesTotal =
    validCountries.reduce(
      (sum, item) =>
        sum +
        item.arrivals_ytd,
      0
    );

  const countries =
    results
      .map(
        (item) => ({
          country:
            item.country.name,

          country_hu:
            item.country.name_hu,

          country_code:
            item.country.code,

          route:
            item.country.route,

          arrivals_ytd:
            item.arrivals_ytd,

          share_of_regional_total_percent:
            calculateShare(
              item.arrivals_ytd,
              regionalTotal
            ),

          latest_month:
            item.latest_month,

          monthly:
            item.records,

          status:
            item.status,

          source:
            "UNHCR",

          source_url:
            item.url
        })
      )
      .sort(
        (a, b) =>
          (
            b.arrivals_ytd ??
            -1
          ) -
          (
            a.arrivals_ytd ??
            -1
          )
      );

  const topCountry =
    countries.find(
      (item) =>
        Number.isFinite(
          item.arrivals_ytd
        )
    ) ?? null;

  const missingCountries =
    countries
      .filter(
        (item) =>
          item.status !== "ok"
      )
      .map(
        (item) =>
          item.country
      );

  const coveragePercent =
    Number.isFinite(
      regionalTotal
    ) &&
    regionalTotal > 0
      ? Number(
          (
            countriesTotal /
            regionalTotal *
            100
          ).toFixed(2)
        )
      : null;

  const output = {
    metadata: {
      dataset:
        "EU Migration Monitor - Country Arrivals",

      generated_at:
        new Date().toISOString(),

      year:
        CURRENT_YEAR,

      source:
        "UNHCR",

      source_dataset:
        "Europe Sea Arrivals",

      source_url:
        "https://data.unhcr.org/en/situations/europe-sea-arrivals",

      coverage: [
        "Italy",
        "Greece",
        "Spain",
        "Cyprus"
      ],

      excluded_from_country_breakdown: [
        "Malta"
      ],

      important_note:
        "Malta is included in the regional UNHCR total but is not estimated as a residual. Country datasets may have different reporting cut-off dates."
    },

    summary: {
      regional_arrivals_ytd:
        regionalTotal,

      country_breakdown_total:
        countriesTotal,

      country_breakdown_coverage_percent:
        coveragePercent,

      covered_countries:
        validCountries.length,

      configured_countries:
        COUNTRIES.length,

      missing_countries:
        missingCountries,

      complete_country_download:
        validCountries.length ===
        COUNTRIES.length,

      top_arrival_country:
        topCountry?.country ??
        null,

      top_arrival_country_hu:
        topCountry
          ?.country_hu ??
        null,

      top_arrival_country_code:
        topCountry
          ?.country_code ??
        null,

      top_arrival_country_arrivals:
        topCountry
          ?.arrivals_ytd ??
        null,

      top_arrival_country_share_percent:
        topCountry
          ?.share_of_regional_total_percent ??
        null
    },

    countries
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
    "COUNTRY ARRIVALS EREDMÉNY"
  );

  console.log(
    "=========================================="
  );

  if (
    Number.isFinite(
      regionalTotal
    )
  ) {
    console.log(
      `Regionális UNHCR YTD: ${regionalTotal.toLocaleString(
        "hu-HU"
      )} fő`
    );
  }

  console.log(
    `Országos bontás összege: ${countriesTotal.toLocaleString(
      "hu-HU"
    )} fő`
  );

  if (
    Number.isFinite(
      coveragePercent
    )
  ) {
    console.log(
      `Lefedettség: ${coveragePercent.toLocaleString(
        "hu-HU"
      )}%`
    );
  }

  console.log(
    `Sikeresen betöltött országok: ${validCountries.length}/${COUNTRIES.length}`
  );

  if (
    missingCountries.length > 0
  ) {
    console.log(
      `Hiányzó országok: ${missingCountries.join(
        ", "
      )}`
    );
  } else {
    console.log(
      "Minden konfigurált ország sikeresen betöltve."
    );
  }

  if (topCountry) {
    console.log(
      `Legnagyobb érkezési ország: ${topCountry.country_hu} – ${topCountry.arrivals_ytd.toLocaleString(
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
}

main().catch(
  (error) => {
    console.error("");

    console.error(
      "Country arrivals adatfrissítési hiba:"
    );

    console.error(
      error
    );

    process.exitCode = 1;
  }
);
