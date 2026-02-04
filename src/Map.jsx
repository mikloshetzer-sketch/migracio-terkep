// src/Map.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function getQueryView() {
  const params = new URLSearchParams(window.location.search);
  return params.get("v") === "routes" ? "routes" : "arrivals";
}

// Fallback coords for NON-EU origin/transit countries (lon,lat)
const EXTRA_COORDS = {
  SY: [38.9968, 34.8021], // Syria (approx center)
  TR: [35.2433, 38.9637], // Turkey
  MA: [-6.8498, 31.7917], // Morocco
  LY: [17.2283, 26.3351], // Libya
  TN: [9.5375, 33.8869],  // Tunisia
  AF: [67.7099, 33.9391], // Afghanistan
  IQ: [43.6793, 33.2232], // Iraq
  IR: [53.6880, 32.4279], // Iran
  EG: [30.8025, 26.8206], // Egypt
  DZ: [1.6596, 28.0339],  // Algeria
};

function bboxCenter(geo) {
  // geo: Polygon or MultiPolygon coordinates
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  const visit = (coord) => {
    const [x, y] = coord;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };

  if (!geo) return null;

  if (geo.type === "Polygon") {
    geo.coordinates.forEach((ring) => ring.forEach(visit));
  } else if (geo.type === "MultiPolygon") {
    geo.coordinates.forEach((poly) => poly.forEach((ring) => ring.forEach(visit)));
  } else {
    return null;
  }

  if (!isFinite(minX)) return null;
  return [(minX + maxX) / 2, (minY + maxY) / 2];
}

function bearing(from, to) {
  // returns degrees
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;

  const [lon1, lat1] = from.map(toRad);
  const [lon2, lat2] = to.map(toRad);

  const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);

  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function formatInt(n) {
  if (typeof n !== "number") return "";
  return n.toLocaleString("hu-HU");
}

export default function Map() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);

  const [view, setView] = useState(getQueryView()); // "arrivals" | "routes"
  const [arrivals, setArrivals] = useState(null);
  const [routes, setRoutes] = useState(null);
  const [topList, setTopList] = useState([]);
  const [maxArrival, setMaxArrival] = useState(1);

  // Keep view in sync if user changes URL manually / back-forward
  useEffect(() => {
    const onPop = () => setView(getQueryView());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const legendStops = useMemo(() => {
    // Same stops used in fill-color
    // [valueRatio, color]
    return [
      [0.0, "#fff5f0"],
      [0.25, "#fcbba1"],
      [0.5, "#fc9272"],
      [0.75, "#fb6a4a"],
      [1.0, "#cb181d"],
    ];
  }, []);

  useEffect(() => {
    if (mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://demotiles.maplibre.org/style.json",
      center: [15, 45],
      zoom: 3.5,
      attributionControl: true,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    mapRef.current = map;

    popupRef.current = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: false,
      maxWidth: "320px",
    });

    // Add a simple arrow image for route heads (triangle), generated via canvas
    map.on("load", () => {
      const size = 64;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");

      // transparent background
      ctx.clearRect(0, 0, size, size);

      // triangle arrow head pointing UP by default (we rotate it later)
      ctx.fillStyle = "rgba(255, 0, 0, 0.85)";
      ctx.beginPath();
      ctx.moveTo(size / 2, 6);
      ctx.lineTo(size - 10, size - 10);
      ctx.lineTo(10, size - 10);
      ctx.closePath();
      ctx.fill();

      const imgData = ctx.getImageData(0, 0, size, size);
      if (!map.hasImage("route-arrowhead")) {
        map.addImage("route-arrowhead", imgData, { pixelRatio: 2 });
      }

      // Sources
      map.addSource("eu", {
        type: "geojson",
        data: "./data/eu_countries.geojson",
      });

      map.addSource("routes", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addSource("route_heads", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      // Base layers
      map.addLayer({
        id: "eu-fill",
        type: "fill",
        source: "eu",
        paint: {
          // default (updated later via feature-state)
          "fill-color": [
            "interpolate",
            ["linear"],
            ["coalesce", ["feature-state", "value"], 0],
            0,
            "#fff5f0",
            10000,
            "#fcbba1",
            40000,
            "#fc9272",
            90000,
            "#fb6a4a",
            180000,
            "#cb181d",
          ],
          "fill-opacity": 0.85,
        },
      });

      map.addLayer({
        id: "eu-outline",
        type: "line",
        source: "eu",
        paint: {
          "line-color": "#ffffff",
          "line-width": 1.2,
          "line-opacity": 0.9,
        },
      });

      // Routes line (thickness based on count)
      map.addLayer({
        id: "routes-line",
        type: "line",
        source: "routes",
        layout: {
          "line-cap": "round",
          "line-join": "round",
          visibility: "none",
        },
        paint: {
          "line-color": "rgba(255, 0, 0, 0.75)",
          "line-width": [
            "interpolate",
            ["linear"],
            ["get", "count"],
            0,
            2,
            50000,
            4,
            120000,
            6,
            250000,
            9,
          ],
          "line-opacity": 0.9,
        },
      });

      // Arrowheads layer (points rotated by bearing)
      map.addLayer({
        id: "routes-heads",
        type: "symbol",
        source: "route_heads",
        layout: {
          visibility: "none",
          "icon-image": "route-arrowhead",
          "icon-size": 0.35,
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "icon-rotation-alignment": "map",
          "icon-rotate": ["get", "bearing"], // degrees
        },
        paint: {
          "icon-opacity": 0.9,
        },
      });

      // Interactions: arrivals tooltip (countries)
      map.on("mousemove", "eu-fill", (e) => {
        if (!e.features?.length) return;
        const f = e.features[0];
        const iso =
          f.properties?.ISO2 ||
          f.properties?.iso2 ||
          f.properties?.CNTR_ID ||
          f.properties?.id ||
          "Unknown";

        const name =
          f.properties?.NAME_EN ||
          f.properties?.name ||
          f.properties?.CNTR_NAME ||
          f.properties?.ADMIN ||
          f.properties?.NAME ||
          "Unknown";

        const val = map.getFeatureState({ source: "eu", id: f.id })?.value ?? 0;

        popupRef.current
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-family:system-ui,Segoe UI,Arial;">
              <div style="font-weight:700;font-size:16px;margin-bottom:4px;">${name}</div>
              <div style="margin-bottom:2px;">Érkezések: <b>${formatInt(val)}</b></div>
              <div style="opacity:.7;">Kód: ${iso}</div>
            </div>`
          )
          .addTo(map);

        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", "eu-fill", () => {
        map.getCanvas().style.cursor = "";
        // do not auto-close popup; user can close with x
      });

      // Interactions: route tooltip
      map.on("mousemove", "routes-line", (e) => {
        if (view !== "routes") return;
        if (!e.features?.length) return;

        const f = e.features[0];
        const from = f.properties?.from ?? "?";
        const to = f.properties?.to ?? "?";
        const count = Number(f.properties?.count ?? 0);
        const path = f.properties?.path ?? "";

        popupRef.current
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-family:system-ui,Segoe UI,Arial;">
              <div style="font-weight:700;font-size:15px;margin-bottom:4px;">${from} → ${to}</div>
              <div style="margin-bottom:2px;">Becsült áramlás: <b>${formatInt(count)}</b> fő</div>
              ${path ? `<div style="opacity:.75;">Útvonal: ${path}</div>` : ""}
            </div>`
          )
          .addTo(map);

        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", "routes-line", () => {
        map.getCanvas().style.cursor = "";
      });
    });

    return () => {
      try {
        map.remove();
      } catch {}
    };
  }, [view]);

  // Load JSON data
  useEffect(() => {
    (async () => {
      const [arr, rts] = await Promise.all([
        fetch("./data/arrivals_2025.json").then((r) => r.json()),
        fetch("./data/routes_2025.json").then((r) => r.json()),
      ]);
      setArrivals(arr);
      setRoutes(rts);

      const vals = Object.values(arr?.totalsByCountry || {}).map((v) => Number(v || 0));
      const maxV = Math.max(1, ...vals);
      setMaxArrival(maxV);

      const sorted = Object.entries(arr?.totalsByCountry || {})
        .map(([k, v]) => ({ iso: k, value: Number(v || 0) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);
      setTopList(sorted);
    })().catch(() => {});
  }, []);

  // Apply arrivals to map (feature-state), build centroids, build routes geojson + arrowheads
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !arrivals || !routes) return;

    const applyAll = async () => {
      if (!map.isStyleLoaded()) return;

      const euSource = map.getSource("eu");
      if (!euSource) return;

      // Wait until eu data is actually available to read (SourceData event)
      const ensureEuReady = () =>
        new Promise((resolve) => {
          const done = () => resolve();
          if (map.isSourceLoaded("eu")) return done();
          const onData = (e) => {
            if (e.sourceId === "eu" && e.isSourceLoaded) {
              map.off("sourcedata", onData);
              done();
            }
          };
          map.on("sourcedata", onData);
        });

      await ensureEuReady();

      const eu = map.getSource("eu")?._data; // (MapLibre internal) works for local geojson
      if (!eu?.features) return;

      // Build centroid lookup for EU ISO2
      const centroidByIso = {};
      eu.features.forEach((f, idx) => {
        // make sure each feature has stable id (needed for feature-state)
        if (f.id === undefined || f.id === null) {
          f.id = f.properties?.ISO2 || f.properties?.CNTR_ID || idx;
        }
        const iso =
          f.properties?.ISO2 || f.properties?.iso2 || f.properties?.CNTR_ID || f.properties?.id;
        const c = bboxCenter(f.geometry);
        if (iso && c) centroidByIso[iso] = c;
      });

      // Re-set data with ids ensured (so feature-state works reliably)
      map.getSource("eu")?.setData({
        ...eu,
        features: eu.features,
      });

      // Apply feature-state values
      const totals = arrivals.totalsByCountry || {};
      eu.features.forEach((f) => {
        const iso =
          f.properties?.ISO2 || f.properties?.iso2 || f.properties?.CNTR_ID || f.properties?.id;
        const value = Number(totals?.[iso] ?? 0);
        map.setFeatureState({ source: "eu", id: f.id }, { value });
      });

      // Update choropleth color stops to match current max (auto scaling)
      // We keep 5 stops based on maxArrival
      const s1 = Math.round(maxArrival * 0.05);
      const s2 = Math.round(maxArrival * 0.20);
      const s3 = Math.round(maxArrival * 0.50);
      const s4 = Math.round(maxArrival * 0.80);
      const s5 = Math.round(maxArrival * 1.0);

      if (map.getLayer("eu-fill")) {
        map.setPaintProperty("eu-fill", "fill-color", [
          "interpolate",
          ["linear"],
          ["coalesce", ["feature-state", "value"], 0],
          0,
          "#fff5f0",
          s1,
          "#fcbba1",
          s2,
          "#fc9272",
          s4,
          "#fb6a4a",
          s5,
          "#cb181d",
        ]);

        // Make arrivals pop in arrivals view, and soften in routes view
        map.setPaintProperty("eu-fill", "fill-opacity", view === "routes" ? 0.55 : 0.85);
      }

      // Build routes geojson lines + arrowhead points
      const routeFeatures = [];
      const headFeatures = [];

      const routeList = routes.routes || [];
      for (const r of routeList) {
        const from = r.from;
        const to = r.to;
        const count = Number(r.count || 0);
        const path = r.path || "";

        const fromCoord = centroidByIso[from] || EXTRA_COORDS[from];
        const toCoord = centroidByIso[to] || EXTRA_COORDS[to];

        if (!fromCoord || !toCoord) continue;

        routeFeatures.push({
          type: "Feature",
          properties: { from, to, count, path },
          geometry: {
            type: "LineString",
            coordinates: [fromCoord, toCoord],
          },
        });

        const b = bearing(fromCoord, toCoord);

        headFeatures.push({
          type: "Feature",
          properties: { from, to, count, path, bearing: b },
          geometry: {
            type: "Point",
            coordinates: toCoord,
          },
        });
      }

      map.getSource("routes")?.setData({
        type: "FeatureCollection",
        features: routeFeatures,
      });

      map.getSource("route_heads")?.setData({
        type: "FeatureCollection",
        features: headFeatures,
      });

      // Toggle layers visibility by view
      const showRoutes = view === "routes";
      map.setLayoutProperty("routes-line", "visibility", showRoutes ? "visible" : "none");
      map.setLayoutProperty("routes-heads", "visibility", showRoutes ? "visible" : "none");
    };

    const onLoadOrStyle = () => applyAll();
    map.on("load", onLoadOrStyle);
    map.on("styledata", onLoadOrStyle);
    applyAll();

    return () => {
      map.off("load", onLoadOrStyle);
      map.off("styledata", onLoadOrStyle);
    };
  }, [arrivals, routes, view, maxArrival]);

  const setUrlView = (next) => {
    const params = new URLSearchParams(window.location.search);
    if (next === "routes") params.set("v", "routes");
    else params.delete("v");
    const newUrl = `${window.location.pathname}?${params.toString()}`.replace(/\?$/, "");
    window.history.pushState({}, "", newUrl);
    setView(next);
  };

  const flyToIso = (iso) => {
    const map = mapRef.current;
    if (!map) return;

    // Try to get centroid from eu source data again
    const eu = map.getSource("eu")?._data;
    if (!eu?.features) return;

    let target = null;
    for (const f of eu.features) {
      const code =
        f.properties?.ISO2 || f.properties?.iso2 || f.properties?.CNTR_ID || f.properties?.id;
      if (code === iso) {
        target = bboxCenter(f.geometry);
        break;
      }
    }
    if (!target) return;

    map.flyTo({ center: target, zoom: 5.2, speed: 0.9 });
  };

  // Legend labels from maxArrival
  const legendLabels = useMemo(() => {
    const maxV = Math.max(1, maxArrival);
    return {
      min: 0,
      q1: Math.round(maxV * 0.25),
      q2: Math.round(maxV * 0.5),
      q3: Math.round(maxV * 0.75),
      max: Math.round(maxV),
    };
  }, [maxArrival]);

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      {/* Map */}
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />

      {/* Controls: View toggle */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          display: "flex",
          gap: 8,
          zIndex: 10,
          padding: 8,
          borderRadius: 12,
          background: "rgba(255,255,255,0.9)",
          boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
          fontFamily: "system-ui, Segoe UI, Arial",
        }}
      >
        <button
          onClick={() => setUrlView("arrivals")}
          style={{
            border: "1px solid rgba(0,0,0,0.15)",
            borderRadius: 10,
            padding: "8px 10px",
            background: view === "arrivals" ? "rgba(0,0,0,0.08)" : "white",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Érkezések
        </button>
        <button
          onClick={() => setUrlView("routes")}
          style={{
            border: "1px solid rgba(0,0,0,0.15)",
            borderRadius: 10,
            padding: "8px 10px",
            background: view === "routes" ? "rgba(0,0,0,0.08)" : "white",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Útvonalak
        </button>
      </div>

      {/* Legend + scale */}
      <div
        style={{
          position: "absolute",
          right: 12,
          top: 12,
          zIndex: 10,
          width: 240,
          padding: 12,
          borderRadius: 14,
          background: "rgba(255,255,255,0.92)",
          boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
          fontFamily: "system-ui, Segoe UI, Arial",
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 8 }}>
          {view === "routes" ? "Érkezések (halványítva)" : "Érkezések"}
        </div>

        {/* Gradient */}
        <div
          style={{
            height: 12,
            borderRadius: 999,
            background: `linear-gradient(90deg,
              ${legendStops.map(([p, c]) => `${c} ${Math.round(p * 100)}%`).join(",")}
            )`,
            border: "1px solid rgba(0,0,0,0.10)",
          }}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12,
            marginTop: 8,
            opacity: 0.8,
          }}
        >
          <span>0</span>
          <span>{formatInt(legendLabels.q2)}</span>
          <span>{formatInt(legendLabels.max)}</span>
        </div>

        {view === "routes" && (
          <>
            <div style={{ height: 10 }} />
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Vonalvastagság</div>
            <div style={{ display: "grid", gap: 8, fontSize: 12, opacity: 0.9 }}>
              {[50000, 120000, 250000].map((v) => (
                <div key={v} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      height: 0,
                      borderTop: `${v === 50000 ? 4 : v === 120000 ? 6 : 9}px solid rgba(255,0,0,0.65)`,
                      width: 52,
                      borderRadius: 999,
                    }}
                  />
                  <div>{formatInt(v)} fő</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Top list panel */}
      <div
        style={{
          position: "absolute",
          right: 12,
          bottom: 12,
          zIndex: 10,
          width: 240,
          maxHeight: 320,
          overflow: "auto",
          padding: 12,
          borderRadius: 14,
          background: "rgba(255,255,255,0.92)",
          boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
          fontFamily: "system-ui, Segoe UI, Arial",
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Top 10 (érkezések)</div>
        {topList.length === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.7 }}>Nincs adat…</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {topList.map((item, i) => (
              <button
                key={item.iso}
                onClick={() => flyToIso(item.iso)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: "white",
                  borderRadius: 12,
                  padding: "8px 10px",
                  cursor: "pointer",
                  textAlign: "left",
                }}
                title="Katt: odaugrás"
              >
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 8,
                      background: "rgba(0,0,0,0.06)",
                      display: "grid",
                      placeItems: "center",
                      fontWeight: 800,
                      fontSize: 12,
                    }}
                  >
                    {i + 1}
                  </div>
                  <div style={{ fontWeight: 700 }}>{item.iso}</div>
                </div>
                <div style={{ fontWeight: 800 }}>{formatInt(item.value)}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
