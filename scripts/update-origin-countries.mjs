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
  "origin-countries.json"
);

const CURRENT_YEAR = new Date().getUTCFullYear();

const ORIGIN_API =
  "https://data.unhcr.org/population/get/origin";

const DESTINATIONS = [
  {
    country: "Italy",
    country_hu: "Olaszország",
    country_code: "IT",

    route:
      "Central Mediterranean",

    scope:
      "sea_arrivals",

    scope_label:
      "Sea arrivals",

    geo_id:
      "656",

    query: {
      fromDate:
        `${CURRENT_YEAR}-01-01`,

      geo_id:
        "656",

      limit:
        "200",

      population_collection:
        "28",

      sv_id:
        "100",

      widget_id:
        "687575"
    }
  },

  {
    country: "Greece",
    country_hu: "Görögország",
    country_code: "GR",

    route:
      "Eastern Mediterranean",

    scope:
      "sea_arrivals",

    scope_label:
      "Sea arrivals",

    geo_id:
      "640",

    query: {
      fromDate:
        `${CURRENT_YEAR}-01-01`,

      geo_id:
        "640",

      limit:
        "16",

      population_collection:
        "28",

      population_group:
        "4996",

      sv_id:
        "100",

      widget_id:
        "688676"
    }
  },

  {
    country: "Spain",
    country_hu: "Spanyolország",
    country_code: "ES",

    route:
      "Western Mediterranean / West African Atlantic",

    scope:
      "sea_and_land_arrivals",

    scope_label:
      "Sea and land arrivals",

    geo_id:
      "729",

    query: {
      fromDate:
        "1900-01-01",

      geo_id:
        "729",

      limit:
        "10",

      population_group:
        "5650,5652,5653,5655,5656,5657,5661,5662,5663,5664,5666,5668,5671,5673,5674,5675,5676,5684,5685,5688,5769",

      sv_id:
        "100",

      widget_id:
        "687070"
    }
  },

  {
    country: "Cyprus",
    country_hu: "Ciprus",
    country_code: "CY",

    route:
      "Eastern Mediterranean",

    scope:
      "all_arrivals",

    scope_label:
      "Sea and land arrivals",

    geo_id:
      "616",

    query: {
      fromDate:
        `${CURRENT_YEAR}-01-01`,

      geo_id:
        "616",

      limit:
        "6",

      population_collection:
        "28",

      sv_id:
        "100",

      widget_id:
        "663858"
    }
  }
];

function buildUrl(destination) {
  const params =
    new URLSearchParams(
      destination.query
    );

  return `${ORIGIN_API}?${params.toString()}`;
}

async function fetchJson(url) {
  const response =
    await fetch(
      url,
      {
        headers: {
          Accept:
            "application/json",

          "User-Agent":
            "EU-Migration-Monitor-Origin/1.0"
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

function getDataArray(payload) {
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

function isAggregateOrigin(
  name,
  code
) {
  const normalizedName =
    String(name ?? "")
      .trim()
      .toLowerCase();

  const normalizedCode =
    String(code ?? "")
      .trim()
      .toUpperCase();

  return (
    normalizedName === "others" ||
    normalizedCode === "OTH"
  );
}

function normaliseRecord(
  raw,
  destination
) {
  if (
    !raw ||
    typeof raw !== "object"
  ) {
    return null;
  }

  const year =
    Number(raw.year);

  if (
    Number.isFinite(year) &&
    year !== CURRENT_YEAR
  ) {
    return null;
  }

  const people =
    parseNumber(
      raw.individuals
    );

  if (
    people === null ||
    people < 0
  ) {
    return null;
  }

  const origin =
    raw.pop_origin_name ??
    null;

  const originCode =
    raw.pop_origin_code ??
    null;

  if (!origin) {
    return null;
  }

  return {
    year:
      CURRENT_YEAR,

    data_date:
      raw.date ??
      null,

    origin_country:
      origin,

    origin_country_code:
      originCode,

    destination_country:
      destination.country,

    destination_country_hu:
      destination.country_hu,

    destination_country_code:
      destination.country_code,

    route:
      destination.route,

    scope:
      destination.scope,

    scope_label:
      destination.scope_label,

    people,

    source:
      raw.source ??
      "UNHCR",

    source_dataset:
      "Europe Sea Arrivals",

    is_aggregate_origin:
      isAggregateOrigin(
        origin,
        originCode
      )
  };
}

function latestDate(records) {
  const dates =
    records
      .map(
        (record) =>
          record.data_date
      )
      .filter(Boolean)
      .sort();

  return dates.at(-1) ?? null;
}

function keepLatestDatasetDate(
  records
) {
  const latest =
    latestDate(records);

  if (!latest) {
    return records;
  }

  return records.filter(
    (record) =>
      record.data_date ===
      latest
  );
}

function sumPeople(records) {
  return records.reduce(
    (sum, record) =>
      sum +
      (
        Number.isFinite(
          record.people
        )
          ? record.people
          : 0
      ),
    0
  );
}

function addDestinationShares(
  records
) {
  const total =
    sumPeople(records);

  return records
    .map(
      (record) => ({
        ...record,

        share_of_published_origin_data_percent:
          total > 0
            ? Number(
                (
                  record.people /
                  total *
                  100
                ).toFixed(2)
              )
            : null
      })
    )
    .sort(
      (a, b) =>
        b.people -
        a.people
    );
}

async function downloadDestination(
  destination
) {
  console.log("");
  console.log(
    "------------------------------------------"
  );

  console.log(
    `${destination.country_hu} származási adatok`
  );

  console.log(
    "------------------------------------------"
  );

  const url =
    buildUrl(
      destination
    );

  console.log(
    `Scope: ${destination.scope}`
  );

  console.log(
    `URL: ${url}`
  );

  const payload =
    await fetchJson(
      url
    );

  const rawRecords =
    getDataArray(
      payload
    );

  console.log(
    `Nyers rekordok: ${rawRecords.length}`
  );

  const normalized =
    rawRecords
      .map(
        (record) =>
          normaliseRecord(
            record,
            destination
          )
      )
      .filter(Boolean);

  const latestRecords =
    keepLatestDatasetDate(
      normalized
    );

  const records =
    addDestinationShares(
      latestRecords
    );

  const dataDate =
    latestDate(
      records
    );

  const total =
    sumPeople(
      records
    );

  console.log(
    `Adatdátum: ${dataDate ?? "nincs"}`
  );

  console.log(
    `Származási kategóriák: ${records.length}`
  );

  console.log(
    `Publikált origin adatok összege: ${total.toLocaleString(
      "hu-HU"
    )} fő`
  );

  if (
    records.length > 0
  ) {
    console.log(
      `Top origin: ${records[0].origin_country} – ${records[0].people.toLocaleString(
        "hu-HU"
      )} fő`
    );
  }

  return {
    destination,

    url,

    data_date:
      dataDate,

    records,

    published_origin_total:
      total,

    status:
      records.length > 0
        ? "ok"
        : "no_data"
  };
}

function aggregateOrigins(
  destinationResults
) {
  const map =
    new Map();

  for (
    const destination
    of destinationResults
  ) {
    for (
      const record
      of destination.records
    ) {
      const key =
        record.origin_country_code ??
        record.origin_country;

      if (!map.has(key)) {
        map.set(
          key,
          {
            origin_country:
              record.origin_country,

            origin_country_code:
              record.origin_country_code,

            people:
              0,

            destination_count:
              0,

            destinations:
              [],

            is_aggregate_origin:
              record.is_aggregate_origin
          }
        );
      }

      const aggregate =
        map.get(key);

      aggregate.people +=
        record.people;

      aggregate.destination_count +=
        1;

      aggregate.destinations.push({
        destination_country:
          record.destination_country,

        destination_country_hu:
          record.destination_country_hu,

        destination_country_code:
          record.destination_country_code,

        route:
          record.route,

        scope:
          record.scope,

        data_date:
          record.data_date,

        people:
          record.people
      });
    }
  }

  return [
    ...map.values()
  ].sort(
    (a, b) =>
      b.people -
      a.people
  );
}

function buildMovementRecords(
  destinationResults
) {
  return destinationResults
    .flatMap(
      (result) =>
        result.records
    )
    .sort(
      (a, b) => {
        if (
          b.people !==
          a.people
        ) {
          return (
            b.people -
            a.people
          );
        }

        return String(
          a.destination_country
        ).localeCompare(
          String(
            b.destination_country
          )
        );
      }
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
    "Origin countries update v1"
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

  const destinationResults =
    [];

  for (
    const destination
    of DESTINATIONS
  ) {
    try {
      const result =
        await downloadDestination(
          destination
        );

      destinationResults.push(
        result
      );
    } catch (error) {
      console.error(
        `${destination.country_hu}: ${error.message}`
      );

      destinationResults.push({
        destination,

        url:
          buildUrl(
            destination
          ),

        data_date:
          null,

        records:
          [],

        published_origin_total:
          0,

        status:
          "source_error"
      });
    }
  }

  const successful =
    destinationResults.filter(
      (item) =>
        item.status === "ok"
    );

  const movementRecords =
    buildMovementRecords(
      destinationResults
    );

  const originTotals =
    aggregateOrigins(
      destinationResults
    );

  const namedOriginTotals =
    originTotals.filter(
      (record) =>
        !record.is_aggregate_origin
    );

  const topOrigin =
    namedOriginTotals[0] ??
    null;

  const topMovement =
    movementRecords.find(
      (record) =>
        !record.is_aggregate_origin
    ) ??
    null;

  const byDestination =
    destinationResults.map(
      (result) => ({
        destination_country:
          result.destination.country,

        destination_country_hu:
          result.destination.country_hu,

        destination_country_code:
          result.destination.country_code,

        route:
          result.destination.route,

        scope:
          result.destination.scope,

        scope_label:
          result.destination.scope_label,

        data_date:
          result.data_date,

        published_origin_total:
          result.published_origin_total,

        origin_categories:
          result.records.length,

        status:
          result.status,

        source_url:
          result.url,

        origins:
          result.records
      })
    );

  const output = {
    metadata: {
      dataset:
        "EU Migration Monitor - Countries of Origin",

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

      important_note:
        "Origin datasets are not fully harmonised across destination countries. Italy and Greece nationality data refer to sea arrivals, Spain refers to sea and land arrivals, and Cyprus refers to arrivals reported in its nationality dataset. Reporting cut-off dates also differ by country.",

      interpretation:
        "Records describe published origin-nationality counts for arrivals into each destination. Aggregated origin totals across destinations are analytical sums of the available country datasets and are not an official EU-wide UNHCR total."
    },

    summary: {
      configured_destinations:
        DESTINATIONS.length,

      successful_destinations:
        successful.length,

      movement_records:
        movementRecords.length,

      distinct_origin_categories:
        originTotals.length,

      distinct_named_origins:
        namedOriginTotals.length,

      top_origin_country:
        topOrigin
          ?.origin_country ??
        null,

      top_origin_country_code:
        topOrigin
          ?.origin_country_code ??
        null,

      top_origin_observed_people:
        topOrigin
          ?.people ??
        null,

      top_origin_destination_count:
        topOrigin
          ?.destination_count ??
        null,

      strongest_observed_movement:
        topMovement
          ? {
              origin_country:
                topMovement.origin_country,

              origin_country_code:
                topMovement.origin_country_code,

              destination_country:
                topMovement.destination_country,

              destination_country_hu:
                topMovement.destination_country_hu,

              destination_country_code:
                topMovement.destination_country_code,

              route:
                topMovement.route,

              scope:
                topMovement.scope,

              people:
                topMovement.people,

              data_date:
                topMovement.data_date
            }
          : null
    },

    by_destination:
      byDestination,

    origin_totals:
      originTotals,

    movements:
      movementRecords
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
    "ORIGIN COUNTRIES EREDMÉNY"
  );

  console.log(
    "=========================================="
  );

  console.log(
    `Sikeres célországok: ${successful.length}/${DESTINATIONS.length}`
  );

  console.log(
    `Mozgási rekordok: ${movementRecords.length}`
  );

  console.log(
    `Megnevezett származási országok: ${namedOriginTotals.length}`
  );

  if (topOrigin) {
    console.log(
      `Legnagyobb megfigyelt origin: ${topOrigin.origin_country} – ${topOrigin.people.toLocaleString(
        "hu-HU"
      )} fő`
    );
  }

  if (topMovement) {
    console.log(
      `Legnagyobb origin → destination kapcsolat: ${topMovement.origin_country} → ${topMovement.destination_country_hu}: ${topMovement.people.toLocaleString(
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
      "Origin countries adatfrissítési hiba:"
    );

    console.error(
      error
    );

    process.exitCode = 1;
  }
);
