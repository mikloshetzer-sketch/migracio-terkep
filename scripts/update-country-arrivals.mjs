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

const TIMESERIES_API =
  "https://data.unhcr.org/population/get/timeseries";

const POPULATION_API =
  "https://data.unhcr.org/population/";

const COUNTRIES = [
  {
    key: "italy",
    name: "Italy",
    name_hu: "Olaszország",
    code: "IT",
    route: "Central Mediterranean",
    mode: "timeseries",
    geo_id: "656",
    population_group: "4797",
    widget_id: "690058"
  },

  {
    key: "greece",
    name: "Greece",
    name_hu: "Görögország",
    code: "GR",
    route: "Eastern Mediterranean",
    mode: "annual_components",
    geomaster_id: "640",

    sea: {
      population_group: "4797",
      widget_id: "688680"
    },

    land: {
      population_group: "4798",
      widget_id: "688681"
    }
  },

  {
    key: "spain",
    name: "Spain",
    name_hu: "Spanyolország",
    code: "ES",
    route:
      "Western Mediterranean / West African Atlantic",
    mode: "timeseries",
    geo_id: "729",
    population_group:
      "4797,4798,5634",
    widget_id: "687069"
  },

  {
    key: "cyprus",
    name: "Cyprus",
    name_hu: "Ciprus",
    code: "CY",
    route: "Eastern Mediterranean",
    mode: "annual_components",
    geomaster_id: "616",

    sea: {
      population_group: "4797",
      widget_id: "663861"
    },

    land: {
      population_group: "4798",
      widget_id: "663862"
    }
  }
];

async function fetchJson(url) {
  const response = await fetch(
    url,
    {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "EU-Migration-Monitor/1.4"
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

  const cleaned =
    String(value)
      .replace(/\s/g, "")
      .replace(/,/g, "")
      .trim();

  const number =
    Number(cleaned);

  return Number.isFinite(number)
    ? Math.round(number)
    : null;
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

    return Number.isFinite(total)
      ? total
      : null;
  } catch {
    return null;
  }
}

function buildTimeseriesUrl(
  country
) {
  const params =
    new URLSearchParams({
      frequency: "month",
      fromDate:
        `${CURRENT_YEAR}-01-01`,
      geo_id:
        country.geo_id,
      population_group:
        country.population_group,
      sv_id:
        "100",
      widget_id:
        country.widget_id
    });

  return `${TIMESERIES_API}?${params.toString()}`;
}

function buildAnnualUrl(
  geomasterId,
  component
) {
  const params =
    new URLSearchParams({
      geo_id:
        geomasterId,

      population_group:
        component.population_group,

      sv_id:
        "100",

      widget_id:
        component.widget_id,

      year:
        "latest"
    });

  return `${POPULATION_API}?${params.toString()}`;
}

function findTimeseries(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

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

  if (
    !payload ||
    typeof payload !== "object"
  ) {
    return [];
  }

  for (
    const value
    of Object.values(payload)
  ) {
    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}

function normaliseTimeseriesRecord(
  record
) {
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

function normaliseTimeseries(
  payload
) {
  const rawRecords =
    findTimeseries(
      payload
    );

  const map =
    new Map();

  for (
    const rawRecord
    of rawRecords
  ) {
    const record =
      normaliseTimeseriesRecord(
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

function parseAnnualPayload(
  payload
) {
  if (
    !payload ||
    typeof payload !== "object"
  ) {
    return null;
  }

  const records =
    Array.isArray(
      payload.data
    )
      ? payload.data
      : [];

  if (
    records.length === 0
  ) {
    return null;
  }

  const validRecords =
    records.filter(
      (record) =>
        Number(
          record.year
        ) === CURRENT_YEAR
    );

  if (
    validRecords.length === 0
  ) {
    return null;
  }

  const latest =
    [...validRecords]
      .sort(
        (a, b) =>
          String(
            a.date ?? ""
          ).localeCompare(
            String(
              b.date ?? ""
            )
          )
      )
      .at(-1);

  const people =
    parseNumber(
      latest.individuals
    );

  if (
    people === null ||
    people < 0
  ) {
    return null;
  }

  return {
    people,

    date:
      latest.date ??
      null,

    year:
      Number(
        latest.year
      ),

    month:
      Number.isFinite(
        Number(
          latest.month
        )
      )
        ? Number(
            latest.month
          )
        : null,

    geomaster_name:
      latest.geomaster_name ??
      null,

    geomaster_id:
      latest.geomaster_id ??
      null,

    population_group_id:
      latest.population_group_id ??
      null
  };
}

async function downloadTimeseriesCountry(
  country
) {
  console.log("");
  console.log(
    "------------------------------------------"
  );

  console.log(
    `${country.name_hu} – havi adatsor`
  );

  console.log(
    "------------------------------------------"
  );

  const url =
    buildTimeseriesUrl(
      country
    );

  console.log(
    `URL: ${url}`
  );

  const payload =
    await fetchJson(
      url
    );

  const records =
    normaliseTimeseries(
      payload
    );

  console.log(
    `Havi rekordok: ${records.length}`
  );

  if (
    records.length === 0
  ) {
    return {
      country,

      arrivals_ytd:
        null,

      sea_arrivals_ytd:
        null,

      land_arrivals_ytd:
        null,

      latest_month:
        null,

      monthly: [],

      status:
        "no_data",

      data_granularity:
        "monthly",

      sources: [
        {
          type:
            "monthly",

          url
        }
      ]
    };
  }

  const arrivalsYtd =
    sumPeople(
      records
    );

  console.log(
    `${country.name_hu} YTD: ${arrivalsYtd.toLocaleString(
      "hu-HU"
    )} fő`
  );

  return {
    country,

    arrivals_ytd:
      arrivalsYtd,

    sea_arrivals_ytd:
      country.code === "IT"
        ? arrivalsYtd
        : null,

    land_arrivals_ytd:
      null,

    latest_month:
      records.at(-1),

    monthly:
      records,

    status:
      "ok",

    data_granularity:
      "monthly",

    sources: [
      {
        type:
          "monthly",

        url
      }
    ]
  };
}

async function downloadAnnualComponent(
  country,
  type,
  component
) {
  const url =
    buildAnnualUrl(
      country.geomaster_id,
      component
    );

  console.log("");
  console.log(
    `${country.name_hu} / ${type}`
  );

  console.log(
    `URL: ${url}`
  );

  const payload =
    await fetchJson(
      url
    );

  const parsed =
    parseAnnualPayload(
      payload
    );

  if (!parsed) {
    console.warn(
      `${country.name_hu} / ${type}: nincs feldolgozható adat.`
    );
  } else {
    console.log(
      `${country.name_hu} / ${type}: ${parsed.people.toLocaleString(
        "hu-HU"
      )} fő`
    );

    console.log(
      `Adat dátuma: ${parsed.date ?? "nincs"}`
    );
  }

  return {
    type,

    url,

    data:
      parsed
  };
}

async function downloadAnnualCountry(
  country
) {
  console.log("");
  console.log(
    "------------------------------------------"
  );

  console.log(
    `${country.name_hu} – éves komponensek`
  );

  console.log(
    "------------------------------------------"
  );

  const sea =
    await downloadAnnualComponent(
      country,
      "sea",
      country.sea
    );

  const land =
    await downloadAnnualComponent(
      country,
      "land",
      country.land
    );

  const seaValue =
    sea.data?.people ??
    null;

  const landValue =
    land.data?.people ??
    null;

  if (
    !Number.isFinite(
      seaValue
    ) &&
    !Number.isFinite(
      landValue
    )
  ) {
    return {
      country,

      arrivals_ytd:
        null,

      sea_arrivals_ytd:
        null,

      land_arrivals_ytd:
        null,

      latest_month:
        null,

      monthly: [],

      status:
        "no_data",

      data_granularity:
        "annual_cumulative",

      sources: [
        sea,
        land
      ]
    };
  }

  const safeSea =
    Number.isFinite(
      seaValue
    )
      ? seaValue
      : 0;

  const safeLand =
    Number.isFinite(
      landValue
    )
      ? landValue
      : 0;

  const arrivalsYtd =
    safeSea +
    safeLand;

  const dates = [
    sea.data?.date,
    land.data?.date
  ]
    .filter(Boolean)
    .sort();

  const latestDataDate =
    dates.at(-1) ??
    null;

  console.log(
    `${country.name_hu} összesen: ${arrivalsYtd.toLocaleString(
      "hu-HU"
    )} fő`
  );

  return {
    country,

    arrivals_ytd:
      arrivalsYtd,

    sea_arrivals_ytd:
      Number.isFinite(
        seaValue
      )
        ? seaValue
        : null,

    land_arrivals_ytd:
      Number.isFinite(
        landValue
      )
        ? landValue
        : null,

    latest_month:
      null,

    monthly: [],

    latest_data_date:
      latestDataDate,

    status:
      "ok",

    data_granularity:
      "annual_cumulative",

    sources: [
      sea,
      land
    ]
  };
}

async function downloadCountry(
  country
) {
  if (
    country.mode ===
    "annual_components"
  ) {
    return downloadAnnualCountry(
      country
    );
  }

  return downloadTimeseriesCountry(
    country
  );
}

async function main() {
  console.log(
    "=========================================="
  );

  console.log(
    "EU MIGRATION MONITOR"
  );

  console.log(
    "Country arrivals update v1.4"
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
    try {
      const result =
        await downloadCountry(
          country
        );

      results.push(
        result
      );
    } catch (error) {
      console.error(
        `${country.name_hu} lekérési hiba: ${error.message}`
      );

      results.push({
        country,

        arrivals_ytd:
          null,

        sea_arrivals_ytd:
          null,

        land_arrivals_ytd:
          null,

        latest_month:
          null,

        monthly: [],

        status:
          "source_error",

        data_granularity:
          country.mode ===
          "annual_components"
            ? "annual_cumulative"
            : "monthly",

        sources: []
      });
    }
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

          sea_arrivals_ytd:
            item.sea_arrivals_ytd,

          land_arrivals_ytd:
            item.land_arrivals_ytd,

          share_of_regional_total_percent:
            calculateShare(
              item.arrivals_ytd,
              regionalTotal
            ),

          latest_month:
            item.latest_month ??
            null,

          latest_data_date:
            item.latest_data_date ??
            null,

          monthly:
            item.monthly,

          status:
            item.status,

          data_granularity:
            item.data_granularity,

          source:
            "UNHCR",

          sources:
            item.sources.map(
              (source) => ({
                type:
                  source.type,

                url:
                  source.url,

                date:
                  source.data?.date ??
                  null,

                people:
                  source.data?.people ??
                  null
              })
            )
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
          !Number.isFinite(
            item.arrivals_ytd
          )
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

      methodology:
        "Italy and Spain use official UNHCR monthly timeseries data. Greece and Cyprus use official UNHCR country-level cumulative sea and land JSON records because the location-level monthly widget endpoint does not expose those datasets through the same timeseries query format.",

      important_note:
        "Country datasets may have different reporting cut-off dates. Malta remains excluded until a stable country-level source is added."
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
        topCountry?.country_hu ??
        null,

      top_arrival_country_code:
        topCountry?.country_code ??
        null,

      top_arrival_country_arrivals:
        topCountry?.arrivals_ytd ??
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
    missingCountries.length >
    0
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
