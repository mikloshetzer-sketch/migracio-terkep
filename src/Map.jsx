import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

/**
 * FULL REPLACEMENT FILE: src/Map.jsx
 *
 * Expects these static files (served by Vite/GitHub Pages from /data/):
 *  - public/data/eu_countries.geojson
 *  - public/data/arrivals_2025.json
 *  - public/data/routes_2025.json
 */

const BASE = import.meta.env.BASE_URL || "/";

// Light grayscale basemap (no token needed)
const STYLE_URL = "https://demotiles.maplibre.org/style.json";

// Helpers
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatNumber(n) {
  try {
    return new Intl.NumberFormat("hu-HU").format(n);
  } catch {
    return String(n);
  }
}

// Basic quantile breaks for choropleth
function computeBreaks(values, k = 5) {
  const v = values
    .map((x) => num(x))
    .filter((x) => x > 0)
    .sort((a, b) => a - b);

  if (v.length === 0) return [0, 1, 10, 100, 1000, 10000];

  const breaks = [0];
  for (let i = 1; i <= k; i++) {
    const idx = Math.min(v.length - 1, Math.floor((i / k) * v.length) - 1);
    breaks.push(v[Math.max(0, idx)]);
  }

  // Make strictly increasing
  for (let i = 1; i < breaks.length; i++) {
    if (breaks[i] <= breaks[i - 1]) breaks[i] = breaks[i - 1] + 1;
  }
  return breaks;
}

// Fallback coordinates for non-EU origins / transit points (lon, lat)
const POINTS = {
  // EU + nearby
  ES: [-3.7492, 40.4637],
  IT: [12.5674, 41.8719],
  GR: [21.8243, 39.0742],
  DE: [10.4515, 51.1657],
  FR: [2.2137, 46.2276],
  AT: [14.5501, 47.5162],
  HU: [19.5033, 47.1625],
  PL: [19.1451, 51.9194],
  RO: [24.9668, 45.9432],
  BG: [25.4858, 42.7339],
  HR: [15.2, 45.1],
  SI: [14.9955, 46.1512],
  SK: [19.699, 48.669],
  CZ: [15.473, 49.817],
  BE: [4.4699, 50.5039],
  NL: [5.2913, 52.1326],
  SE: [18.6435, 60.1282],
  DK: [9.5018, 56.2639],
  FI: [25.7482, 61.9241],
  IE: [-8.2439, 53.4129],
  PT: [-8.2245, 39.3999],
  CY: [33.4299, 35.1264],
  MT: [14.3754, 35.9375],

  // Origins / transit mentioned
  MA: [-6.0, 32.5], // Morocco (Rabat-ish)
  LY: [17.0, 27.0], // Libya (central-ish)
  TN: [9.5, 34.0], // Tunisia
  TR: [35.2433, 38.9637], // Turkey
  SY: [38.9968, 34.8021], // Syria
  AF: [66.0047, 33.9391], // Afghanistan

  // Optional extras if you add later
  IQ: [43.6793, 33.2232],
  IR: [53.688, 32.4279],
  EG: [30.8025, 26.8206],
};

function getFeatureIso2(feature) {
  const p = feature?.properties || {};
  // Try common fields in GISCO/Eurostat exports
  return (
    p.ISO2 ||
    p.iso2 ||
    p.CNTR_ID ||
    p.cntr_id ||
    p.ISO_A2 ||
    p.iso_a2 ||
    p.ADM0_A3 || // sometimes not ISO2, but we try
    null
  );
}

export default function Map() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);

  useEffect(() => {
    if (mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: STYLE_URL,
      center: [15, 46],
      zoom: 3.8,
    });

    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");

    popupRef.current = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: false,
      maxWidth: "280px",
    });

    const params = new URLSearchParams(window.location.search);
    const view = (params.get("v") || "arrivals").toLowerCase(); // arrivals | routes

    async function loadAll() {
      // 1) Load arrivals
      const arrivalsUrl = new URL("data/arrivals_2025.json", window.location.origin + BASE).toString();
      const routesUrl = new URL("data/routes_2025.json", window.location.origin + BASE).toString();
      const euGeoUrl = new URL("data/eu_countries.geojson", window.location.origin + BASE).toString();

      const [arrivals, routes, euGeo] = await Promise.all([
        fetch(arrivalsUrl).then((r) => r.json()),
        fetch(routesUrl).then((r) => r.json()),
        fetch(euGeoUrl).then((r) => r.json()),
      ]);

      const totalsByCountry = arrivals?.totalsByCountry || {};

      // 2) Join: add "value" to each EU feature by ISO2 / CNTR_ID
      const enriched = {
        type: "FeatureCollection",
        features: (euGeo?.features || []).map((f) => {
          const iso2Raw = getFeatureIso2(f);
          const iso2 = typeof iso2Raw === "string" ? iso2Raw.toUpperCase() : null;
          const value = iso2 && totalsByCountry[iso2] != null ? num(totalsByCountry[iso2]) : 0;

          return {
            ...f,
            properties: {
              ...(f.properties || {}),
              __iso2: iso2 || "Unknown",
              __value: value,
            },
          };
        }),
      };

      const values = enriched.features.map((f) => f.properties.__value);
      const breaks = computeBreaks(values, 5);
      // breaks: [0, b1, b2, b3, b4, b5]

      // 3) Add sources
      if (map.getSource("eu")) map.removeSource("eu");
      map.addSource("eu", { type: "geojson", data: enriched });

      // 4) Choropleth layers
      const fillId = "eu-fill";
      const outlineId = "eu-outline";

      if (map.getLayer(fillId)) map.removeLayer(fillId);
      if (map.getLayer(outlineId)) map.removeLayer(outlineId);

      // Step coloring (no custom palette requests: use simple grayscale-ish reds)
      map.addLayer({
        id: fillId,
        type: "fill",
        source: "eu",
        paint: {
          "fill-opacity": 0.55,
          "fill-color": [
            "step",
            ["get", "__value"],
            "#f2f2f2", // 0
            breaks[1],
            "#fee5d9",
            breaks[2],
            "#fcbba1",
            breaks[3],
            "#fc9272",
            breaks[4],
            "#fb6a4a",
            breaks[5],
            "#de2d26",
          ],
        },
      });

      map.addLayer({
        id: outlineId,
        type: "line",
        source: "eu",
        paint: {
          "line-color": "#ffffff",
          "line-width": 1,
          "line-opacity": 0.9,
        },
      });

      // 5) Hover tooltip for arrivals
      const onMove = (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: [fillId] });
        if (!features.length) {
          map.getCanvas().style.cursor = "";
          popupRef.current.remove();
          return;
        }

        map.getCanvas().style.cursor = "pointer";
        const f = features[0];
        const iso2 = f.properties.__iso2 || "Unknown";
        const value = num(f.properties.__value || 0);

        // Try a better label if present
        const name =
          f.properties.NAME_EN ||
          f.properties.name ||
          f.properties.NAME ||
          f.properties.CNTR_NAME ||
          iso2;

        popupRef.current
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;">
               <div style="font-weight:700; font-size:14px; margin-bottom:4px;">${name}</div>
               <div style="font-size:13px;">Érkezések: <b>${formatNumber(value)}</b></div>
               <div style="opacity:0.7; font-size:12px; margin-top:2px;">Kód: ${iso2}</div>
             </div>`
          )
          .addTo(map);
      };

      // Avoid stacking listeners on reload
      map.off("mousemove", fillId, onMove);
      map.on("mousemove", fillId, onMove);

      map.off("mouseleave", fillId, () => {});
      map.on("mouseleave", fillId, () => {
        map.getCanvas().style.cursor = "";
        popupRef.current.remove();
      });

      // 6) ROUTES: build GeoJSON from routes_2025.json
      // Expected structure:
      // {
      //   "year": 2025,
      //   "unit": "people",
      //   "routes": [{ "from":"SY", "to":"GR", "count":120000, "path":"Eastern Mediterranean" }, ...]
      // }
      const routeList = Array.isArray(routes?.routes) ? routes.routes : [];

      const routeFeatures = [];
      for (const r of routeList) {
        const from = (r.from || "").toUpperCase();
        const to = (r.to || "").toUpperCase();
        const count = num(r.count || 0);
        const label = r.path || "Route";

        const fromPt = POINTS[from];
        const toPt = POINTS[to];

        if (!fromPt || !toPt) continue;

        routeFeatures.push({
          type: "Feature",
          geometry: { type: "LineString", coordinates: [fromPt, toPt] },
          properties: {
            from,
            to,
            count,
            label,
          },
        });
      }

      const routesGeo = { type: "FeatureCollection", features: routeFeatures };

      if (map.getSource("routes")) map.removeSource("routes");
      map.addSource("routes", { type: "geojson", data: routesGeo });

      const routesLineId = "routes-line";
      const routesArrowId = "routes-arrows";

      if (map.getLayer(routesArrowId)) map.removeLayer(routesArrowId);
      if (map.getLayer(routesLineId)) map.removeLayer(routesLineId);

      map.addLayer({
        id: routesLineId,
        type: "line",
        source: "routes",
        paint: {
          "line-color": "#ff2d2d",
          "line-opacity": 0.75,
          "line-width": [
            "interpolate",
            ["linear"],
            ["get", "count"],
            0,
            2,
            50000,
            4,
            150000,
            7,
            300000,
            10,
          ],
        },
      });

      // Arrow-like markers along the line using a text symbol that follows the line
      map.addLayer({
        id: routesArrowId,
        type: "symbol",
        source: "routes",
        layout: {
          "symbol-placement": "line",
          "symbol-spacing": 180,
          "text-field": "➤",
          "text-size": 18,
          "text-keep-upright": false,
          "text-rotation-alignment": "map",
          "text-pitch-alignment": "map",
        },
        paint: {
          "text-color": "#ff2d2d",
          "text-opacity": 0.85,
        },
      });

      // Route hover popup
      const onRouteMove = (e) => {
        const feats = map.queryRenderedFeatures(e.point, { layers: [routesLineId] });
        if (!feats.length) return;

        const f = feats[0];
        const { from, to, count, label } = f.properties || {};

        map.getCanvas().style.cursor = "pointer";
        popupRef.current
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;">
               <div style="font-weight:700; font-size:14px; margin-bottom:4px;">${label || "Route"}</div>
               <div style="font-size:13px;">${from} → ${to}</div>
               <div style="font-size:13px; margin-top:4px;">Becsült: <b>${formatNumber(num(count))}</b> fő</div>
             </div>`
          )
          .addTo(map);
      };

      map.off("mousemove", routesLineId, onRouteMove);
      map.on("mousemove", routesLineId, onRouteMove);

      map.off("mouseleave", routesLineId, () => {});
      map.on("mouseleave", routesLineId, () => {
        map.getCanvas().style.cursor = "";
        popupRef.current.remove();
      });

      // 7) View behavior
      // Keep arrivals always visible; optionally zoom/center for routes view
      if (view === "routes" && routeFeatures.length > 0) {
        // Fit bounds to routes roughly
        const coords = routeFeatures.flatMap((f) => f.geometry.coordinates);
        let minX = coords[0][0],
          minY = coords[0][1],
          maxX = coords[0][0],
          maxY = coords[0][1];
        for (const [x, y] of coords) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
        map.fitBounds(
          [
            [minX, minY],
            [maxX, maxY],
          ],
          { padding: 40, duration: 800 }
        );
      }
    }

    map.on("load", () => {
      loadAll().catch((err) => {
        // Show something useful in console
        console.error("Failed to load data:", err);
      });
    });

    return () => {
      try {
        popupRef.current?.remove();
        map.remove();
      } catch {
        // ignore
      }
    };
  }, []);

  return <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />;
}
