import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, "..");

const MIGRATION_DIR = path.join(
  ROOT_DIR,
  "public",
  "data",
  "migration"
);

const UNHCR_FILE = path.join(
  MIGRATION_DIR,
  "unhcr-arrivals.json"
);

const SNAPSHOT_FILE = path.join(
  MIGRATION_DIR,
  "arrival-snapshots.json"
);

const OUTPUT_FILE = path.join(
  MIGRATION_DIR,
  "summary.json"
);

async function readJson(file) {
  const text = await fs.readFile(
    file,
    "utf8"
  );

  return JSON.parse(text);
}

function numberOrNull(value) {
  return Number.isFinite(value)
    ? value
    : null;
}

function calculatePercentChange(
  current,
  previous
) {
  if (
    !Number.isFinite(current) ||
    !Number.isFinite(previous) ||
    previous === 0
  ) {
    return null;
  }

  return Number(
    (
      ((current - previous) /
        previous) *
      100
    ).toFixed(2)
  );
}

function calculateShare(
  value,
  total
) {
  if (
    !Number.isFinite(value) ||
    !Number.isFinite(total) ||
    total === 0
  ) {
    return null;
  }

  return Number(
    (
      (value / total) *
      100
    ).toFixed(2)
  );
}

function getCurrentUtcYearMonth() {
  const now = new Date();

  return {
    year:
      now.getUTCFullYear(),

    month:
      now.getUTCMonth() + 1
  };
}

function isCurrentMonth(record) {
  if (
    !record ||
    !Number.isInteger(record.year) ||
    !Number.isInteger(record.month)
  ) {
    return false;
  }

  const current =
    getCurrentUtcYearMonth();

  return (
    record.year === current.year &&
    record.month === current.month
  );
}

function getLatestMonth(
  monthly
) {
  if (
    !Array.isArray(monthly) ||
    monthly.length === 0
  ) {
    return null;
  }

  return monthly[
    monthly.length - 1
  ];
}

function getLatestCompleteMonth(
  monthly
) {
  if (
    !Array.isArray(monthly) ||
    monthly.length === 0
  ) {
    return null;
  }

  const completeMonths =
    monthly.filter(
      (record) =>
        !isCurrentMonth(record)
    );

  if (
    completeMonths.length === 0
  ) {
    return null;
  }

  return completeMonths[
    completeMonths.length - 1
  ];
}

function getPreviousCompleteMonth(
  monthly,
  latestCompleteMonth
) {
  if (
    !Array.isArray(monthly) ||
    !latestCompleteMonth
  ) {
    return null;
  }

  const completeMonths =
    monthly.filter(
      (record) =>
        !isCurrentMonth(record) &&
        record.date <
          latestCompleteMonth.date
    );

  if (
    completeMonths.length === 0
  ) {
    return null;
  }

  return completeMonths[
    completeMonths.length - 1
  ];
}

function buildPeriodBlock(
  period,
  label
) {
  if (
    !period ||
    typeof period !== "object"
  ) {
    return {
      label,
      available: false,
      arrivals: null,
      actual_days: null,
      reference_date: null,
      current_date: null,
      status:
        "not_available"
    };
  }

  return {
    label,

    available:
      period.available === true,

    arrivals:
      numberOrNull(
        period.reported_arrivals
      ),

    actual_days:
      numberOrNull(
        period.actual_days
      ),

    reference_date:
      period.reference_date ??
      period.previous_date ??
      null,

    current_date:
      period.current_date ??
      null,

    status:
      period.status ??
      "unknown"
  };
}

function validateUnhcr(data) {
  if (
    !data ||
    typeof data !== "object"
  ) {
    throw new Error(
      "Az UNHCR adatfájl hibás."
    );
  }

  if (
    !data.summary ||
    typeof data.summary !== "object"
  ) {
    throw new Error(
      "Hiányzik az UNHCR summary."
    );
  }

  if (
    !Number.isFinite(
      data.summary.arrivals_ytd
    )
  ) {
    throw new Error(
      "Hiányzik az UNHCR arrivals_ytd."
    );
  }

  if (
    !Array.isArray(
      data.monthly
    )
  ) {
    throw new Error(
      "Hiányzik az UNHCR havi adatsor."
    );
  }
}

function validateSnapshots(data) {
  if (
    !data ||
    typeof data !== "object"
  ) {
    throw new Error(
      "A snapshot adatfájl hibás."
    );
  }

  if (
    !Array.isArray(
      data.snapshots
    )
  ) {
    throw new Error(
      "Hiányzik a snapshot történet."
    );
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
    "Migration summary build v1.1"
  );

  console.log(
    "=========================================="
  );

  const unhcr =
    await readJson(
      UNHCR_FILE
    );

  const snapshots =
    await readJson(
      SNAPSHOT_FILE
    );

  validateUnhcr(
    unhcr
  );

  validateSnapshots(
    snapshots
  );

  const unhcrSummary =
    unhcr.summary;

  const latestMonth =
    getLatestMonth(
      unhcr.monthly
    );

  const latestMonthIsPartial =
    latestMonth
      ? isCurrentMonth(
          latestMonth
        )
      : false;

  const latestCompleteMonth =
    getLatestCompleteMonth(
      unhcr.monthly
    );

  const previousCompleteMonth =
    getPreviousCompleteMonth(
      unhcr.monthly,
      latestCompleteMonth
    );

  const completeMonthChange =
    latestCompleteMonth &&
    previousCompleteMonth
      ? latestCompleteMonth.people -
        previousCompleteMonth.people
      : null;

  const completeMonthChangePercent =
    latestCompleteMonth &&
    previousCompleteMonth
      ? calculatePercentChange(
          latestCompleteMonth.people,
          previousCompleteMonth.people
        )
      : null;

  const seaShare =
    calculateShare(
      unhcrSummary.sea_arrivals_ytd,
      unhcrSummary.arrivals_ytd
    );

  const landShare =
    calculateShare(
      unhcrSummary.land_arrivals_ytd,
      unhcrSummary.arrivals_ytd
    );

  const sevenDay =
    buildPeriodBlock(
      snapshots.periods?.seven_day,
      "Last 7 days"
    );

  const thirtyDay =
    buildPeriodBlock(
      snapshots.periods?.thirty_day,
      "Last 30 days"
    );

  const latestReported =
    buildPeriodBlock(
      snapshots.periods?.latest,
      "Latest reported change"
    );

  const output = {
    metadata: {
      dataset:
        "EU Migration Monitor - Dashboard Summary",

      generated_at:
        new Date().toISOString(),

      source:
        "UNHCR",

      source_dataset:
        "Europe Sea Arrivals",

      source_url:
        "https://data.unhcr.org/en/situations/europe-sea-arrivals",

      interpretation:
        "Seven-day and thirty-day values represent changes in cumulative UNHCR reporting between stored snapshots. Current-month arrival values are treated as partial and are not compared directly with a completed previous month."
    },

    headline: {
      year:
        unhcrSummary.year,

      arrivals_ytd:
        unhcrSummary.arrivals_ytd,

      sea_arrivals_ytd:
        unhcrSummary.sea_arrivals_ytd,

      land_arrivals_ytd:
        unhcrSummary.land_arrivals_ytd,

      sea_share_percent:
        seaShare,

      land_share_percent:
        landShare
    },

    periods: {
      last_7_days:
        sevenDay,

      last_30_days:
        thirtyDay,

      latest_reported_change:
        latestReported
    },

    latest_month: {
      date:
        latestMonth?.date ??
        null,

      arrivals:
        numberOrNull(
          latestMonth?.people
        ),

      sea_arrivals:
        numberOrNull(
          latestMonth?.sea_arrivals
        ),

      land_arrivals:
        numberOrNull(
          latestMonth?.land_arrivals
        ),

      month_status:
        latestMonth
          ? (
              latestMonthIsPartial
                ? "partial"
                : "complete"
            )
          : "not_available",

      month_complete:
        latestMonth
          ? !latestMonthIsPartial
          : false,

      change:
        latestMonthIsPartial
          ? null
          : numberOrNull(
              completeMonthChange
            ),

      change_percent:
        latestMonthIsPartial
          ? null
          : numberOrNull(
              completeMonthChangePercent
            )
    },

    complete_month_comparison: {
      available:
        Boolean(
          latestCompleteMonth &&
          previousCompleteMonth
        ),

      latest_complete_month: {
        date:
          latestCompleteMonth?.date ??
          null,

        arrivals:
          numberOrNull(
            latestCompleteMonth?.people
          ),

        sea_arrivals:
          numberOrNull(
            latestCompleteMonth?.sea_arrivals
          ),

        land_arrivals:
          numberOrNull(
            latestCompleteMonth?.land_arrivals
          )
      },

      previous_complete_month: {
        date:
          previousCompleteMonth?.date ??
          null,

        arrivals:
          numberOrNull(
            previousCompleteMonth?.people
          ),

        sea_arrivals:
          numberOrNull(
            previousCompleteMonth?.sea_arrivals
          ),

        land_arrivals:
          numberOrNull(
            previousCompleteMonth?.land_arrivals
          )
      },

      change:
        numberOrNull(
          completeMonthChange
        ),

      change_percent:
        numberOrNull(
          completeMonthChangePercent
        )
    },

    data_status: {
      snapshot_count:
        snapshots.snapshots.length,

      seven_day_available:
        sevenDay.available,

      thirty_day_available:
        thirtyDay.available,

      latest_available_month:
        unhcrSummary.latest_available_month ??
        null,

      latest_month_partial:
        latestMonthIsPartial,

      source_arithmetic_check:
        unhcr.diagnostics
          ?.arithmetic_check
          ?.status ??
        null
    }
  };

  await fs.mkdir(
    MIGRATION_DIR,
    {
      recursive: true
    }
  );

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
    "SUMMARY EREDMÉNY"
  );

  console.log(
    "=========================================="
  );

  console.log(
    `YTD: ${output.headline.arrivals_ytd.toLocaleString(
      "hu-HU"
    )} fő`
  );

  console.log(
    `Tengeri: ${output.headline.sea_arrivals_ytd.toLocaleString(
      "hu-HU"
    )} fő`
  );

  console.log(
    `Szárazföldi: ${output.headline.land_arrivals_ytd.toLocaleString(
      "hu-HU"
    )} fő`
  );

  if (
    output.periods
      .last_7_days
      .available
  ) {
    console.log(
      `7 nap: ${output.periods.last_7_days.arrivals.toLocaleString(
        "hu-HU"
      )} fő`
    );
  } else {
    console.log(
      "7 nap: még nincs elegendő adat"
    );
  }

  if (
    output.periods
      .last_30_days
      .available
  ) {
    console.log(
      `30 nap: ${output.periods.last_30_days.arrivals.toLocaleString(
        "hu-HU"
      )} fő`
    );
  } else {
    console.log(
      "30 nap: még nincs elegendő adat"
    );
  }

  if (latestMonth) {
    console.log(
      `Aktuális havi adat: ${latestMonth.people.toLocaleString(
        "hu-HU"
      )} fő`
    );

    console.log(
      `Aktuális hónap státusza: ${
        latestMonthIsPartial
          ? "részleges"
          : "lezárt"
      }`
    );
  }

  if (
    latestCompleteMonth &&
    previousCompleteMonth
  ) {
    console.log(
      `Utolsó lezárt hónap: ${latestCompleteMonth.date}`
    );

    console.log(
      `Utolsó lezárt havi érték: ${latestCompleteMonth.people.toLocaleString(
        "hu-HU"
      )} fő`
    );

    console.log(
      `Előző lezárt hónap: ${previousCompleteMonth.date}`
    );

    console.log(
      `Lezárt havi változás: ${completeMonthChange.toLocaleString(
        "hu-HU"
      )} fő`
    );

    console.log(
      `Lezárt havi változás: ${completeMonthChangePercent}%`
    );
  }

  console.log(
    `Snapshotok: ${snapshots.snapshots.length}`
  );

  console.log(
    `Kimenet: ${OUTPUT_FILE}`
  );

  console.log(
    "=========================================="
  );

  console.log(
    "Migration summary sikeresen elkészült."
  );
}

main().catch((error) => {
  console.error("");
  console.error(
    "Migration summary hiba:"
  );

  console.error(error);

  process.exitCode = 1;
});
