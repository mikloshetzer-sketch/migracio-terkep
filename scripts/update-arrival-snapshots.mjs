import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, "..");

const INPUT_FILE = path.join(
  ROOT_DIR,
  "public",
  "data",
  "migration",
  "unhcr-arrivals.json"
);

const OUTPUT_FILE = path.join(
  ROOT_DIR,
  "public",
  "data",
  "migration",
  "arrival-snapshots.json"
);

function getUtcDateString() {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

function parseDate(dateString) {
  return new Date(
    `${dateString}T00:00:00Z`
  );
}

function daysBetween(
  earlierDate,
  laterDate
) {
  const earlier =
    parseDate(earlierDate);

  const later =
    parseDate(laterDate);

  return Math.round(
    (
      later.getTime() -
      earlier.getTime()
    ) /
      86400000
  );
}

async function readJson(file) {
  const text =
    await fs.readFile(
      file,
      "utf8"
    );

  return JSON.parse(text);
}

async function readHistory() {
  try {
    return await readJson(
      OUTPUT_FILE
    );
  } catch (error) {
    if (
      error.code === "ENOENT"
    ) {
      return {
        metadata: {
          dataset:
            "EU Migration Monitor - Arrival Snapshot History",

          created_at:
            new Date().toISOString(),

          source:
            "UNHCR",

          methodology:
            "Daily snapshots of the cumulative UNHCR year-to-date arrival figure.",

          interpretation:
            "Period changes represent arrivals newly reported by UNHCR between snapshots, not necessarily arrivals that physically occurred during the exact same period."
        },

        summary: {},

        periods: {},

        snapshots: []
      };
    }

    throw error;
  }
}

function validateCurrentData(
  currentData
) {
  if (
    !currentData ||
    typeof currentData !== "object"
  ) {
    throw new Error(
      "Az UNHCR input nem érvényes objektum."
    );
  }

  const summary =
    currentData.summary;

  if (
    !summary ||
    typeof summary !== "object"
  ) {
    throw new Error(
      "Hiányzik az UNHCR summary objektum."
    );
  }

  if (
    !Number.isFinite(
      summary.arrivals_ytd
    )
  ) {
    throw new Error(
      "Hiányzik vagy hibás az arrivals_ytd érték."
    );
  }

  if (
    summary.arrivals_ytd < 0
  ) {
    throw new Error(
      "Az arrivals_ytd nem lehet negatív."
    );
  }

  if (
    !Number.isInteger(
      summary.year
    )
  ) {
    throw new Error(
      "Hiányzik vagy hibás a summary.year érték."
    );
  }
}

function createSnapshot(
  currentData
) {
  const summary =
    currentData.summary;

  return {
    date:
      getUtcDateString(),

    captured_at:
      new Date().toISOString(),

    year:
      summary.year,

    arrivals_ytd:
      summary.arrivals_ytd,

    sea_arrivals_ytd:
      Number.isFinite(
        summary.sea_arrivals_ytd
      )
        ? summary.sea_arrivals_ytd
        : null,

    land_arrivals_ytd:
      Number.isFinite(
        summary.land_arrivals_ytd
      )
        ? summary.land_arrivals_ytd
        : null,

    latest_available_month:
      summary.latest_available_month ??
      null,

    latest_month_arrivals:
      Number.isFinite(
        summary.latest_month_arrivals
      )
        ? summary.latest_month_arrivals
        : null,

    source:
      "UNHCR"
  };
}

function upsertSnapshot(
  snapshots,
  newSnapshot
) {
  const filtered =
    snapshots.filter(
      (snapshot) =>
        snapshot.date !==
        newSnapshot.date
    );

  filtered.push(
    newSnapshot
  );

  return filtered.sort(
    (a, b) =>
      a.date.localeCompare(
        b.date
      )
  );
}

function findReferenceSnapshot(
  snapshots,
  currentSnapshot,
  targetDays
) {
  const candidates =
    snapshots
      .filter(
        (snapshot) => {
          if (
            snapshot.date ===
            currentSnapshot.date
          ) {
            return false;
          }

          if (
            snapshot.year !==
            currentSnapshot.year
          ) {
            return false;
          }

          const difference =
            daysBetween(
              snapshot.date,
              currentSnapshot.date
            );

          return (
            difference >=
            targetDays
          );
        }
      )
      .sort(
        (a, b) => {
          const aDifference =
            daysBetween(
              a.date,
              currentSnapshot.date
            );

          const bDifference =
            daysBetween(
              b.date,
              currentSnapshot.date
            );

          return (
            aDifference -
            bDifference
          );
        }
      );

  return candidates[0] ?? null;
}

function calculatePeriod(
  snapshots,
  currentSnapshot,
  targetDays
) {
  const reference =
    findReferenceSnapshot(
      snapshots,
      currentSnapshot,
      targetDays
    );

  if (!reference) {
    return {
      available: false,

      target_days:
        targetDays,

      reported_arrivals:
        null,

      reference_date:
        null,

      current_date:
        currentSnapshot.date,

      actual_days:
        null,

      start_ytd:
        null,

      end_ytd:
        currentSnapshot.arrivals_ytd,

      status:
        "insufficient_history"
    };
  }

  const actualDays =
    daysBetween(
      reference.date,
      currentSnapshot.date
    );

  const difference =
    currentSnapshot.arrivals_ytd -
    reference.arrivals_ytd;

  return {
    available: true,

    target_days:
      targetDays,

    reported_arrivals:
      difference,

    reference_date:
      reference.date,

    current_date:
      currentSnapshot.date,

    actual_days:
      actualDays,

    start_ytd:
      reference.arrivals_ytd,

    end_ytd:
      currentSnapshot.arrivals_ytd,

    status:
      difference >= 0
        ? "ok"
        : "source_revision_detected"
  };
}

function findPreviousSnapshot(
  snapshots,
  currentSnapshot
) {
  const previous =
    snapshots
      .filter(
        (snapshot) =>
          snapshot.date <
            currentSnapshot.date &&
          snapshot.year ===
            currentSnapshot.year
      )
      .sort(
        (a, b) =>
          b.date.localeCompare(
            a.date
          )
      );

  return previous[0] ?? null;
}

function calculateLatestChange(
  snapshots,
  currentSnapshot
) {
  const previous =
    findPreviousSnapshot(
      snapshots,
      currentSnapshot
    );

  if (!previous) {
    return {
      available: false,

      reported_arrivals:
        null,

      previous_date:
        null,

      current_date:
        currentSnapshot.date,

      actual_days:
        null,

      previous_ytd:
        null,

      current_ytd:
        currentSnapshot.arrivals_ytd,

      status:
        "no_previous_snapshot"
    };
  }

  const actualDays =
    daysBetween(
      previous.date,
      currentSnapshot.date
    );

  const difference =
    currentSnapshot.arrivals_ytd -
    previous.arrivals_ytd;

  return {
    available: true,

    reported_arrivals:
      difference,

    previous_date:
      previous.date,

    current_date:
      currentSnapshot.date,

    actual_days:
      actualDays,

    previous_ytd:
      previous.arrivals_ytd,

    current_ytd:
      currentSnapshot.arrivals_ytd,

    status:
      difference >= 0
        ? "ok"
        : "source_revision_detected"
  };
}

function removeInvalidSnapshots(
  snapshots
) {
  return snapshots.filter(
    (snapshot) =>
      snapshot &&
      typeof snapshot === "object" &&
      typeof snapshot.date === "string" &&
      Number.isInteger(snapshot.year) &&
      Number.isFinite(
        snapshot.arrivals_ytd
      )
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
    "Arrival snapshot update v1.1"
  );

  console.log(
    "=========================================="
  );

  const currentData =
    await readJson(
      INPUT_FILE
    );

  validateCurrentData(
    currentData
  );

  const history =
    await readHistory();

  if (
    !Array.isArray(
      history.snapshots
    )
  ) {
    history.snapshots = [];
  }

  history.snapshots =
    removeInvalidSnapshots(
      history.snapshots
    );

  const currentSnapshot =
    createSnapshot(
      currentData
    );

  console.log(
    `Snapshot dátuma: ${currentSnapshot.date}`
  );

  console.log(
    `UNHCR YTD: ${currentSnapshot.arrivals_ytd.toLocaleString(
      "hu-HU"
    )} fő`
  );

  history.snapshots =
    upsertSnapshot(
      history.snapshots,
      currentSnapshot
    );

  const latestChange =
    calculateLatestChange(
      history.snapshots,
      currentSnapshot
    );

  const sevenDay =
    calculatePeriod(
      history.snapshots,
      currentSnapshot,
      7
    );

  const thirtyDay =
    calculatePeriod(
      history.snapshots,
      currentSnapshot,
      30
    );

  history.metadata = {
    dataset:
      "EU Migration Monitor - Arrival Snapshot History",

    source:
      "UNHCR",

    source_dataset:
      "Europe Sea Arrivals",

    source_url:
      "https://data.unhcr.org/en/situations/europe-sea-arrivals",

    updated_at:
      new Date().toISOString(),

    methodology:
      "Daily snapshots of the cumulative UNHCR year-to-date arrival figure.",

    interpretation:
      "Period changes represent arrivals newly reported by UNHCR between snapshots, not necessarily arrivals that physically occurred during the exact same period."
  };

  history.summary = {
    year:
      currentSnapshot.year,

    current_date:
      currentSnapshot.date,

    arrivals_ytd:
      currentSnapshot.arrivals_ytd,

    sea_arrivals_ytd:
      currentSnapshot.sea_arrivals_ytd,

    land_arrivals_ytd:
      currentSnapshot.land_arrivals_ytd,

    snapshot_count:
      history.snapshots.length,

    latest_reported_change:
      latestChange.reported_arrivals,

    latest_change_days:
      latestChange.actual_days,

    seven_day_reported_arrivals:
      sevenDay.reported_arrivals,

    seven_day_available:
      sevenDay.available,

    seven_day_actual_days:
      sevenDay.actual_days,

    thirty_day_reported_arrivals:
      thirtyDay.reported_arrivals,

    thirty_day_available:
      thirtyDay.available,

    thirty_day_actual_days:
      thirtyDay.actual_days
  };

  history.periods = {
    latest:
      latestChange,

    seven_day:
      sevenDay,

    thirty_day:
      thirtyDay
  };

  await fs.mkdir(
    path.dirname(
      OUTPUT_FILE
    ),
    {
      recursive: true
    }
  );

  await fs.writeFile(
    OUTPUT_FILE,
    JSON.stringify(
      history,
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
    "SNAPSHOT EREDMÉNY"
  );

  console.log(
    "=========================================="
  );

  console.log(
    `Snapshotok száma: ${history.snapshots.length}`
  );

  console.log(
    `Aktuális YTD: ${currentSnapshot.arrivals_ytd.toLocaleString(
      "hu-HU"
    )} fő`
  );

  if (
    latestChange.available
  ) {
    console.log(
      `Legutóbbi jelentett változás: ${latestChange.reported_arrivals.toLocaleString(
        "hu-HU"
      )} fő`
    );
  } else {
    console.log(
      "Legutóbbi változás: még nincs korábbi snapshot."
    );
  }

  if (
    sevenDay.available
  ) {
    console.log(
      `7 napos jelentett érkezés: ${sevenDay.reported_arrivals.toLocaleString(
        "hu-HU"
      )} fő`
    );
  } else {
    console.log(
      "7 napos érték: még nincs elegendő történeti adat."
    );
  }

  if (
    thirtyDay.available
  ) {
    console.log(
      `30 napos jelentett érkezés: ${thirtyDay.reported_arrivals.toLocaleString(
        "hu-HU"
      )} fő`
    );
  } else {
    console.log(
      "30 napos érték: még nincs elegendő történeti adat."
    );
  }

  console.log(
    `Kimenet: ${OUTPUT_FILE}`
  );

  console.log(
    "=========================================="
  );

  console.log(
    "Snapshot frissítés sikeresen befejezve."
  );
}

main().catch((error) => {
  console.error("");
  console.error(
    "Snapshot adatfrissítési hiba:"
  );

  console.error(error);

  process.exitCode = 1;
});
