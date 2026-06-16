import fs from "node:fs/promises";
import path from "node:path";

const OUT_DIR = path.join(process.cwd(), "public", "data");

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

const query = encodeURIComponent(
  'migration refugee asylum border Hungary Balkans'
);

function scoreEvent(title = "", domain = "") {
  const text = `${title} ${domain}`.toLowerCase();
  let score = 20;

  for (const word of keywords) {
    if (text.includes(word)) score += 8;
  }

  return Math.min(score, 100);
}

function normalizeGdeltDate(value) {
  if (!value) return null;

  const text = String(value);
  if (text.length < 8) return null;

  return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}T${
    text.slice(8, 10) || "00"
  }:${text.slice(10, 12) || "00"}:${text.slice(12, 14) || "00"}Z`;
}

async function fetchGdeltArticles() {
  const url =
    `https://api.gdeltproject.org/api/v2/doc/doc?query=${query}` +
    "&mode=ArtList" +
    "&format=json" +
    "&maxrecords=10" +
    "&sort=DateDesc" +
    "&timespan=1d";

  const response = await fetch(url, {
    headers: {
      "User-Agent": "EMIC-Migration-Monitor/1.0"
    }
  });

  const text = await response.text();

  if (response.status === 429) {
    return {
      status: "rate_limited",
      reports: [],
      message: text.trim()
    };
  }

  if (!response.ok) {
    return {
      status: "source_error",
      reports: [],
      message: `GDELT API error: ${response.status} ${text}`
    };
  }

  const json = JSON.parse(text);
  const articles = json.articles || [];

  return {
    status: "ok",
    reports: articles.map((item, index) => {
      const title = item.title || "Untitled article";
      const domain = item.domain || "";

      return {
        id: item.url || `gdelt-${index}`,
        title,
        url: item.url || "",
        date: normalizeGdeltDate(item.seendate),
        countries: [],
        sources: [domain].filter(Boolean),
        score: scoreEvent(title, domain)
      };
    }),
    message: "ok"
  };
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const result = await fetchGdeltArticles();

  const payload = {
    updated_at: new Date().toISOString(),
    source: "GDELT Project API",
    status: result.status,
    message: result.message,
    count: result.reports.length,
    reports: result.reports
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
        event_count: payload.count,
        message: payload.message
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(
    `Live migration data update completed: ${payload.status}, ${payload.count} articles`
  );
}

main().catch((error) => {
  console.error(error);

  await fs.mkdir(OUT_DIR, { recursive: true });

  await fs.writeFile(
    path.join(OUT_DIR, "live-events.json"),
    JSON.stringify(
      {
        updated_at: new Date().toISOString(),
        source: "GDELT Project API",
        status: "script_error",
        message: String(error.message || error),
        count: 0,
        reports: []
      },
      null,
      2
    ),
    "utf8"
  );

  process.exit(0);
});
