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
  "western-balkans.json"
);

const CURRENT_YEAR = 2026;

const SOURCE = {
  organisation: "UNHCR",
  dataset:
    "Route-Based Approach operationalization in the Western Balkans",
  document:
    "RCSEE Route Based Approach Western Balkans Factsheet (May 2026)",
  source_url:
    "https://data.unhcr.org/en/documents/details/122696",
  pdf_url:
    "https://data.unhcr.org/en/documents/download/122696",
  publication_date:
    "2026-06-02",
  reporting_period_start:
    "2026-01-01",
  reporting_period_end:
    "2026-04-30"
};

const COUNTRIES = [
  {
    country: "Albania",
    country_hu: "Albánia",
    country_code: "AL",

    asylum_intentions_ytd: 11,
    asylum_intentions_latest_month: 0,

    asylum_applications_ytd: 5,
    asylum_applications_latest_month: 2,

    decisions_ytd: 18,
    recognition_rate_percent: 57,
    pending_cases: 18
  },

  {
    country: "Bosnia and Herzegovina",
    country_hu: "Bosznia-Hercegovina",
    country_code: "BA",

    asylum_intentions_ytd: 3811,
    asylum_intentions_latest_month: 1137,

    asylum_applications_ytd: 54,
    asylum_applications_latest_month: 22,

    decisions_ytd: 44,
    recognition_rate_percent: 76,
    pending_cases: 193
  },

  {
    country: "Montenegro",
    country_hu: "Montenegró",
    country_code: "ME",

    asylum_intentions_ytd: 1511,
    asylum_intentions_latest_month: 450,

    asylum_applications_ytd: 52,
    asylum_applications_latest_month: 19,

    decisions_ytd: 56,
    recognition_rate_percent: 23,
    pending_cases: 220
  },

  {
    country: "North Macedonia",
    country_hu: "Észak-Macedónia",
    country_code: "MK",

    asylum_intentions_ytd: null,
    asylum_intentions_latest_month: null,

    asylum_applications_ytd: 32,
    asylum_applications_latest_month: 11,

    decisions_ytd: 29,
    recognition_rate_percent: 0,
    pending_cases: 14
  },

  {
    country: "Serbia",
    country_hu: "Szerbia",
    country_code: "RS",

    asylum_intentions_ytd: 129,
    asylum_intentions_latest_month: 19,

    asylum_applications_ytd: 59,
    asylum_applications_latest_month: 14,

    decisions_ytd: 53,
    recognition_rate_percent: 18,
    pending_cases: 122
  },

  {
    country: "Kosovo",
    country_hu: "Koszovó",
    country_code: "XK",

    asylum_intentions_ytd: null,
    asylum_intentions_latest_month: null,

    asylum_applications_ytd: 65,
    asylum_applications_latest_month: 21,

    decisions_ytd: 18,
    recognition_rate_percent: 0,
    pending_cases: 12
  }
];

const INTENTION_NATIONALITIES = [
  {
    origin_country: "Sudan",
    origin_country_hu: "Szudán",
    origin_country_code: "SD",
    share_percent: 41
  },

  {
    origin_country: "Egypt",
    origin_country_hu: "Egyiptom",
    origin_country_code: "EG",
    share_percent: 20
  },

  {
    origin_country: "Afghanistan",
    origin_country_hu: "Afganisztán",
    origin_country_code: "AF",
    share_percent: 16
  },

  {
    origin_country: "Bangladesh",
    origin_country_hu: "Banglades",
    origin_country_code: "BD",
    share_percent: 3
  },

  {
    origin_country: "Pakistan",
    origin_country_hu: "Pakisztán",
    origin_country_code: "PK",
    share_percent: 3
  }
];

const APPLICATION_NATIONALITIES = [
  {
    origin_country: "Russia",
    origin_country_hu: "Oroszország",
    origin_country_code: "RU",
    share_percent: 18
  },

  {
    origin_country: "Türkiye",
    origin_country_hu: "Törökország",
    origin_country_code: "TR",
    share_percent: 12
  },

  {
    origin_country: "Egypt",
    origin_country_hu: "Egyiptom",
    origin_country_code: "EG",
    share_percent: 9
  },

  {
    origin_country: "Sudan",
    origin_country_hu: "Szudán",
    origin_country_code: "SD",
    share_percent: 7
  },

  {
    origin_country: "Syria",
    origin_country_hu: "Szíria",
    origin_country_code: "SY",
    share_percent: 7
  }
];

const POSITIVE_DECISION_NATIONALITIES = [
  {
    origin_country: "Russia",
    origin_country_hu: "Oroszország",
    origin_country_code: "RU",
    share_percent: 26
  },

  {
    origin_country: "Stateless",
    origin_country_hu: "Hontalan",
    origin_country_code: null,
    share_percent: 19
  },

  {
    origin_country: "Afghanistan",
    origin_country_hu: "Afganisztán",
    origin_country_code: "AF",
    share_percent: 12
  },

  {
    origin_country: "Sudan",
    origin_country_hu: "Szudán",
    origin_country_code: "SD",
    share_percent: 12
  },

  {
    origin_country: "Belarus",
    origin_country_hu: "Belarusz",
    origin_country_code: "BY",
    share_percent: 5
  }
];

const RPMS = {
  sample_size: 437,

  interview_period_start:
    "2025-11-01",

  interview_period_end:
    "2026-04-30",

  average_age: 27,

  gender: {
    male_percent: 94,
    female_percent: 6
  },

  interviews_by_country_percent: [
    {
      country: "Albania",
      country_hu: "Albánia",
      percent: 25
    },
    {
      country: "Bosnia and Herzegovina",
      country_hu: "Bosznia-Hercegovina",
      percent: 22
    },
    {
      country: "Montenegro",
      country_hu: "Montenegró",
      percent: 4
    },
    {
      country: "North Macedonia",
      country_hu: "Észak-Macedónia",
      percent: 19
    },
    {
      country: "Serbia",
      country_hu: "Szerbia",
      percent: 19
    },
    {
      country: "Kosovo",
      country_hu: "Koszovó",
      percent: 10
    }
  ],

  refugee_producing_origins: [
    {
      origin_country: "Sudan",
      origin_country_hu: "Szudán",
      percent: 49
    },
    {
      origin_country: "Afghanistan",
      origin_country_hu: "Afganisztán",
      percent: 28
    },
    {
      origin_country: "Syria",
      origin_country_hu: "Szíria",
      percent: 6
    },
    {
      origin_country: "China",
      origin_country_hu: "Kína",
      percent: 6
    },
    {
      origin_country: "Palestine",
      origin_country_hu: "Palesztina",
      percent: 4
    }
  ],

  other_origins: [
    {
      origin_country: "Egypt",
      origin_country_hu: "Egyiptom",
      percent: 28
    },
    {
      origin_country: "Russia",
      origin_country_hu: "Oroszország",
      percent: 9
    },
    {
      origin_country: "Bangladesh",
      origin_country_hu: "Banglades",
      percent: 9
    },
    {
      origin_country: "Morocco",
      origin_country_hu: "Marokkó",
      percent: 8
    },
    {
      origin_country: "Algeria",
      origin_country_hu: "Algéria",
      percent: 7
    }
  ],

  intended_destinations_refugee_producing: [
    {
      country: "France",
      country_hu: "Franciaország",
      percent: 29
    },
    {
      country: "Germany",
      country_hu: "Németország",
      percent: 27
    },
    {
      country: "Italy",
      country_hu: "Olaszország",
      percent: 18
    }
  ],

  intended_destinations_other: [
    {
      country: "Italy",
      country_hu: "Olaszország",
      percent: 33
    },
    {
      country: "Germany",
      country_hu: "Németország",
      percent: 14
    },
    {
      country: "France",
      country_hu: "Franciaország",
      percent: 10
    }
  ]
};

function sumFinite(records, field) {
  return records.reduce(
    (sum, record) =>
      sum +
      (
        Number.isFinite(
          record[field]
        )
          ? record[field]
          : 0
      ),
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

function enrichCountries(
  countries,
  totalIntentions,
  totalApplications
) {
  return countries.map(
    (country) => ({
      ...country,

      asylum_intentions_share_percent:
        calculateShare(
          country.asylum_intentions_ytd,
          totalIntentions
        ),

      asylum_applications_share_percent:
        calculateShare(
          country.asylum_applications_ytd,
          totalApplications
        )
    })
  );
}

function findTopCountry(
  countries,
  field
) {
  return countries
    .filter(
      (country) =>
        Number.isFinite(
          country[field]
        )
    )
    .sort(
      (a, b) =>
        b[field] -
        a[field]
    )[0] ?? null;
}

async function main() {
  console.log(
    "=========================================="
  );

  console.log(
    "EU MIGRATION MONITOR"
  );

  console.log(
    "Western Balkans update v1"
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

  const totalIntentions =
    sumFinite(
      COUNTRIES,
      "asylum_intentions_ytd"
    );

  const latestMonthIntentions =
    sumFinite(
      COUNTRIES,
      "asylum_intentions_latest_month"
    );

  const totalApplications =
    sumFinite(
      COUNTRIES,
      "asylum_applications_ytd"
    );

  const latestMonthApplications =
    sumFinite(
      COUNTRIES,
      "asylum_applications_latest_month"
    );

  const totalDecisions =
    sumFinite(
      COUNTRIES,
      "decisions_ytd"
    );

  const totalPendingCases =
    sumFinite(
      COUNTRIES,
      "pending_cases"
    );

  const countries =
    enrichCountries(
      COUNTRIES,
      totalIntentions,
      totalApplications
    );

  const topIntentionCountry =
    findTopCountry(
      countries,
      "asylum_intentions_ytd"
    );

  const topApplicationCountry =
    findTopCountry(
      countries,
      "asylum_applications_ytd"
    );

  const output = {
    metadata: {
      dataset:
        "EU Migration Monitor - Western Balkans Route",

      generated_at:
        new Date().toISOString(),

      year:
        CURRENT_YEAR,

      region:
        "Western Balkans",

      route:
        "Western Balkans Route",

      source:
        SOURCE.organisation,

      source_dataset:
        SOURCE.dataset,

      source_document:
        SOURCE.document,

      source_url:
        SOURCE.source_url,

      source_pdf:
        SOURCE.pdf_url,

      publication_date:
        SOURCE.publication_date,

      reporting_period: {
        start:
          SOURCE.reporting_period_start,

        end:
          SOURCE.reporting_period_end
      },

      measurement:
        "asylum_intentions_and_applications",

      important_note:
        "Asylum intentions do not represent unique individuals. The same person may express an intention to apply for asylum in multiple Western Balkan countries.",

      methodology_note:
        "North Macedonia and Kosovo currently do not use the two-step asylum intention procedure used by the countries represented in the asylum-intentions table. Their null intention values must not be interpreted as zero migration activity.",

      dashboard_rule:
        "Western Balkans asylum intentions and applications must not be added directly to Mediterranean arrival totals."
    },

    summary: {
      asylum_intentions_ytd:
        totalIntentions,

      asylum_intentions_latest_month:
        latestMonthIntentions,

      latest_month:
        "2026-04",

      asylum_applications_ytd:
        totalApplications,

      asylum_applications_latest_month:
        latestMonthApplications,

      decisions_ytd:
        totalDecisions,

      pending_cases:
        totalPendingCases,

      regional_recognition_rate_percent:
        36,

      countries:
        countries.length,

      countries_with_intention_data:
        countries.filter(
          (country) =>
            Number.isFinite(
              country.asylum_intentions_ytd
            )
        ).length,

      top_intention_country:
        topIntentionCountry
          ? {
              country:
                topIntentionCountry.country,

              country_hu:
                topIntentionCountry.country_hu,

              country_code:
                topIntentionCountry.country_code,

              intentions:
                topIntentionCountry.asylum_intentions_ytd,

              share_percent:
                topIntentionCountry.asylum_intentions_share_percent
            }
          : null,

      top_application_country:
        topApplicationCountry
          ? {
              country:
                topApplicationCountry.country,

              country_hu:
                topApplicationCountry.country_hu,

              country_code:
                topApplicationCountry.country_code,

              applications:
                topApplicationCountry.asylum_applications_ytd,

              share_percent:
                topApplicationCountry.asylum_applications_share_percent
            }
          : null,

      top_intention_nationality:
        INTENTION_NATIONALITIES[0],

      top_application_nationality:
        APPLICATION_NATIONALITIES[0]
    },

    countries,

    nationalities: {
      asylum_intentions:
        INTENTION_NATIONALITIES,

      asylum_applications:
        APPLICATION_NATIONALITIES,

      positive_decisions:
        POSITIVE_DECISION_NATIONALITIES
    },

    route_intelligence: {
      rpms:
        RPMS,

      dominant_refugee_producing_origin:
        RPMS.refugee_producing_origins[0],

      dominant_other_origin:
        RPMS.other_origins[0],

      primary_intended_destination_refugee_producing:
        RPMS
          .intended_destinations_refugee_producing[0],

      primary_intended_destination_other:
        RPMS
          .intended_destinations_other[0]
    },

    interpretation: {
      what_it_measures:
        "The asylum-process section measures registered intentions to apply for asylum, submitted asylum applications, first-instance decisions and pending cases in Western Balkan countries.",

      what_it_does_not_measure:
        "It does not measure unique migrants crossing the Western Balkan route and it is not directly comparable with UNHCR Mediterranean sea-and-land arrival totals.",

      route_context:
        "The RPMS section describes profiles and intended destinations of interviewed refugees, asylum-seekers and other people moving through the Western Balkans. Survey percentages describe the interviewed sample and cannot automatically be extrapolated to the entire route population."
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
    "WESTERN BALKANS EREDMÉNY"
  );

  console.log(
    "=========================================="
  );

  console.log(
    `Asylum intentions YTD: ${totalIntentions.toLocaleString(
      "hu-HU"
    )}`
  );

  console.log(
    `Áprilisi intentions: ${latestMonthIntentions.toLocaleString(
      "hu-HU"
    )}`
  );

  console.log(
    `Asylum applications YTD: ${totalApplications.toLocaleString(
      "hu-HU"
    )}`
  );

  console.log(
    `Áprilisi applications: ${latestMonthApplications.toLocaleString(
      "hu-HU"
    )}`
  );

  console.log(
    `Döntések YTD: ${totalDecisions.toLocaleString(
      "hu-HU"
    )}`
  );

  console.log(
    `Függő ügyek: ${totalPendingCases.toLocaleString(
      "hu-HU"
    )}`
  );

  if (topIntentionCountry) {
    console.log(
      `Legnagyobb intention ország: ${topIntentionCountry.country_hu} – ${topIntentionCountry.asylum_intentions_ytd.toLocaleString(
        "hu-HU"
      )}`
    );
  }

  console.log(
    `Top származási ország: ${INTENTION_NATIONALITIES[0].origin_country_hu} – ${INTENTION_NATIONALITIES[0].share_percent}%`
  );

  console.log(
    `Kimenet: ${OUTPUT_FILE}`
  );

  console.log(
    "=========================================="
  );

  console.log(
    "Western Balkans adatfájl elkészült."
  );
}

main().catch(
  (error) => {
    console.error("");

    console.error(
      "Western Balkans adatfrissítési hiba:"
    );

    console.error(
      error
    );

    process.exitCode = 1;
  }
);
