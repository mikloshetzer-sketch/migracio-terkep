import fs from "node:fs/promises";
import path from "node:path";

const OUT_DIR = path.join(process.cwd(), "public", "data");

const watchedCountries = [
  "Mali",
  "Niger",
  "Burkina Faso",
  "Chad",
  "Sudan",
  "Libya",
  "Tunisia",
  "Türkiye",
  "Greece",
  "Serbia",
  "Bosnia and Herzegovina",
  "Hungary"
];

const keywords = [
  "migration",
  "migrant",
  "refugee",
  "asylum",
  "displacement",
  "border",
  "humanitarian",
  "conflict"
];

function scoreEvent(title = "", body = "") {
  const text = `${title} ${body}`.toLowerCase();

  let score = 20;

  for (const word of keywords) {
    if (text.includes(word)) score += 8;
  }

  if (text.includes("conflict")) score += 10;
  if (text.includes("border")) score += 8;
  if (text.includes("displacement")) score += 10;
  if (text.includes("refugee")) score += 8;

  return Math.min(score, 100);
}

async function fetchReliefWebReports() {
  const url = "https://api.reliefweb.int/v2/reports?appname=emic-migration-monitor";

  const body = {
    limit: 30,
    profile: "list",
    preset: "latest",
    fields: {
      include: [
        "title",
        "url",
        "date.created",
        "country.name",
        "source.name"
      ]
    },
    filter: {
      operator: "AND",
      conditions: [
        {
          field: "country.name",
          value: watchedCountries,
          operator: "OR"
        },
        {
          field: "date.created",
          value: {
            from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
          }
        }
      ]
    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`ReliefWeb API error: ${response.status}`);
  }

  const json = await response.json();

  return json.data.map((item) => {
    const fields = item.fields || {};
    const title = fields.title || "Untitled report";
    const countries = fields.country?.map((c) => c.name) || [];
    const sources = fields.source?.map((s) => s.name) || [];

    return {
      id: item.id,
      title,
      url: fields.url || "",
      date: fields.date?.created || null,
      countries,
      sources,
      score: scoreEvent(title, countries.join(" "))
    };
  });
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const reports = await fetchReliefWebReports();

  const payload = {
    updated_at: new Date().toISOString(),
    source: "ReliefWeb API",
    status: "ok",
    count: reports.length,
    reports
  };

  await fs.writeFile(
    path.join(OUT_DIR, "live-events.json"),
    JSON.stringify(payload, null, 2),
    "utf8"
  );

  await fs.writeFile(
    path.join(process.cwd(), "public", "last-update.json"),
    JSON.stringify(
      {
        updated_at: payload.updated_at,
        source: payload.source,
        status: payload.status,
        event_count: payload.count
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(`Live migration data updated: ${reports.length} reports`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
