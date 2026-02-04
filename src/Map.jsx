// src/Map.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const asset = (p) => `${import.meta.env.BASE_URL}${p}`;

const fmt = (n) => {
  const x = Number(n ?? 0);
  return x.toLocaleString("hu-HU");
};

const getIso2 = (props = {}) =>
  props.ISO2 || props.CNTR_ID || props.ISO_A2 || props.iso2 || props.cntr_id || props.iso_a2 || null;

// Fallback koordináták (lon, lat) – bővíthető.
// EU/EEA + néhány kulcs ország a routes-hoz (MA, TR, SY, AF stb.)
const ISO2_COORDS = {
  // EU (nagyjából főváros-közeli pontok)
  AT: [16.3738, 48.2082],
  BE: [4.3517, 50.8503],
  BG: [23.3219, 42.6977],
  HR: [15.9819, 45.8150],
  CY: [33.3823, 35.1856],
  CZ: [14.4378, 50.0755],
  DK: [12.5683, 55.6761],
  EE: [24.7536, 59.4370],
  FI: [24.9384, 60.1699],
  FR: [2.3522, 48.8566],
  DE: [13.4050, 52.5200],
  GR: [23.7275, 37.9838],
  HU: [19.0402, 47.4979],
  IE: [-6.2603, 53.3498],
  IT: [12.4964, 41.9028],
  LV: [24.1052, 56.9496],
  LT: [25.2797, 54.6872],
  LU: [6.1319, 49.6116],
  MT: [14.5146, 35.8989],
  NL: [4.9041, 52.3676],
  PL: [21.0122, 52.2297],
  PT: [-9.1393, 38.7223],
  RO: [26.1025, 44.4268],
  SK: [17.1077, 48.1486],
  SI: [14.5058, 46.0569],
  ES: [-3.7038, 40.4168],
  SE: [18.0686, 59.3293],

  // Non-EU a térképen / routes-ban
  UK: [-0.1276, 51.5072],
  CH: [7.4474, 46.9480],
  NO: [10.7522, 59.9139],
  RS: [20.4489, 44.7866],
  BA: [18.4131, 43.8563],
  AL: [19.8187, 41.3275],
  MK: [21.4316, 41.9981],
  ME: [19.2594, 42.4304],

  MA: [-6.8416, 34.0209], // Rabat (Morocco)
  DZ: [3.0588, 36.7538],
  TN: [10.1815, 36.8065],
  LY: [13.1913, 32.8872],
  EG: [31.2357, 30.0444],

  TR: [32.8597, 39.9334], // Ankara
  SY: [36.2765, 33.5138], // Damascus
  LB: [35.5018, 33.8938],
  JO: [35.9106, 31.9539],
  IQ: [44.3661, 33.3152],
  IR: [51.3890, 35.6892],

  UA: [30.5234, 50.4501],
  MD: [28.8638, 47.0105],
  GE: [44.8271, 41.7151],
  AM: [44.5152, 40.1872],
  AZ: [49.8671, 40.4093],

  AF: [69.2075, 34.5553], // Kabul
};

function makeRouteFeature(rt, idx) {
  // 1) ha van explicit koordináta a JSON-ben, azt használjuk
  const coords = rt.coordinates || rt.coords;
  if (Array.isArray(coords) && coords.length >= 2) {
    return {
      type: "Feature",
      id: idx,
      properties: {
        from: rt.from,
        to: rt.to,
        count: Number(rt.count || 0),
        path: rt.path || "",
      },
      geometry: { type: "LineString", coordinates: coords },
    };
  }

  // 2) fallback: ISO2 -> pont
  const a = ISO2_COORDS[rt.from];
  const b = ISO2_COORDS[rt.to];
  if (!a || !b) return null;

  return {
    type: "Feature",
    id: idx,
    properties: {
      from: rt.from,
      to: rt.to,
      count: Number(rt.count || 0),
      path: rt.path || "",
    },
    geometry: { type: "LineString", coordinates: [a, b] },
  };
}

export default function Map() {
  const mapRef = useRef(null);
  const mapDivRef = useRef(null);

  const [view, setView] = useState(() => {
    const v = new URLSearchParams(window.location.search).get("v");
    return v === "routes" ? "routes" : "arrivals";
  });

  const [arrivals, setArrivals] = useState(null);
  const [routes, setRoutes] = useState(null);
  const [geo, setGeo] = useState(null);

  const [countryPopup, setCountryPopup] = useState(null);
  const [routePopup, setRoutePopup] = useState(null);

  // adatok
  useEffect(() => {
    let alive = true;
    (async () => {
      const [g, a, r] = await Promise.all([
        fetch(asset("data/eu_countries.geojson")).then((x) => x.json()),
        fetch(asset("data/arrivals_2025.json")).then((x) => x.json()),
        fetch(asset("data/routes_2025.json")).then((x) => x.json()),
      ]);

      if (!alive) return;

      const patched = {
        ...g,
        features: (g.features || []).map((f) => {
          const iso2 = getIso2(f.properties) || f.id || null;
          return { ...f, properties: { ...(f.properties || {}), ISO2: iso2 } };
        }),
      };

      setGeo(patched);
      setArrivals(a);
      setRoutes(r);
    })();

    return () => {
      alive = false;
    };
  }, []);

  const top10 = useMemo(() => {
    const m = arrivals?.totalsByCountry || {};
    return Object.entries(m)
      .map(([iso2, value]) => ({ iso2, value: Number(value || 0) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [arrivals]);

  const arrivalsMinMax = useMemo(() => {
    const m = arrivals?.totalsByCountry || {};
    const vals = Object.values(m).map((x) => Number(x || 0));
    if (!vals.length) return { min: 0, max: 1, mid: 1 };
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const mid = Math.round((min + max) / 2);
    return { min, mid, max };
  }, [arrivals]);

  // map init
  useEffect(() => {
    if (mapRef.current) return;
    if (!mapDivRef.current) return;

    const map = new maplibregl.Map({
      container: mapDivRef.current,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: [14, 46],
      zoom: 3.6,
      minZoom: 2,
      maxZoom: 10,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!geo || !arrivals || !routes) return;

    const onLoad = () => {
      // countries source
      if (!map.getSource("countries")) {
        map.addSource("countries", { type: "geojson", data: geo, promoteId: "ISO2" });
      } else {
        map.getSource("countries").setData(geo);
      }

      // routes geojson (fallback koordinátákkal!)
      const feats = (routes?.routes || [])
        .map((rt, idx) => makeRouteFeature(rt, idx))
        .filter(Boolean);

      const routesGeojson = { type: "FeatureCollection", features: feats };

      if (!map.getSource("routes")) {
        map.addSource("routes", { type: "geojson", data: routesGeojson });
      } else {
        map.getSource("routes").setData(routesGeojson);
      }

      // countries fill
      if (!map.getLayer("countries-fill")) {
        map.addLayer({
          id: "countries-fill",
          type: "fill",
          source: "countries",
          paint: {
            "fill-color": [
              "interpolate",
              ["linear"],
              ["coalesce", ["feature-state", "arrivals"], 0],
              arrivalsMinMax.min,
              "#fde0dd",
              arrivalsMinMax.mid,
              "#fcae91",
              arrivalsMinMax.max,
              "#fb6a4a",
            ],
            "fill-opacity": view === "routes" ? 0.15 : 0.75,
          },
        });
      }

      // outline
      if (!map.getLayer("countries-outline")) {
        map.addLayer({
          id: "countries-outline",
          type: "line",
          source: "countries",
          paint: { "line-color": "#ffffff", "line-width": 1.2, "line-opacity": 0.9 },
        });
      }

      // routes line
      if (!map.getLayer("routes-line")) {
        map.addLayer({
          id: "routes-line",
          type: "line",
          source: "routes",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#ef4444",
            "line-opacity": 0.85,
            "line-width": [
              "interpolate",
              ["linear"],
              ["get", "count"],
              0,
              1.5,
              50000,
              3.5,
              120000,
              6,
              250000,
              9,
            ],
          },
        });
      }

      // arrows
      if (!map.getLayer("routes-arrows")) {
        map.addLayer({
          id: "routes-arrows",
          type: "symbol",
          source: "routes",
          layout: {
            "symbol-placement": "line",
            "symbol-spacing": 120,
            "text-field": "▶",
            "text-size": 14,
            "text-keep-upright": false,
            "text-rotation-alignment": "map",
          },
          paint: { "text-color": "#ef4444", "text-opacity": 0.9 },
        });
      }

      // view apply
      const applyView = (v) => {
        const isRoutes = v === "routes";
        if (map.getLayer("routes-line")) map.setLayoutProperty("routes-line", "visibility", isRoutes ? "visible" : "none");
        if (map.getLayer("routes-arrows")) map.setLayoutProperty("routes-arrows", "visibility", isRoutes ? "visible" : "none");
        if (map.getLayer("countries-fill")) map.setPaintProperty("countries-fill", "fill-opacity", isRoutes ? 0.15 : 0.75);
      };
      applyView(view);

      // feature-state arrivals
      const totals = arrivals?.totalsByCountry || {};
      (geo.features || []).forEach((f) => {
        const iso2 = getIso2(f.properties);
        if (!iso2) return;
        map.setFeatureState({ source: "countries", id: iso2 }, { arrivals: Number(totals[iso2] ?? 0) });
      });

      // events
      const onCountryClick = (e) => {
        const feat = e.features?.[0];
        if (!feat) return;
        const iso2 = getIso2(feat.properties);
        const name =
          feat.properties?.NAME_EN ||
          feat.properties?.name ||
          feat.properties?.NAME ||
          feat.properties?.CNTR_NAME ||
          "Ismeretlen";
        const value = Number((arrivals?.totalsByCountry || {})[iso2] ?? 0);
        setCountryPopup({ name, iso2: iso2 || "??", value });
        setRoutePopup(null);
      };

      const onRouteMove = (e) => {
        const feat = e.features?.[0];
        if (!feat) return;
        setRoutePopup({
          from: feat.properties?.from || "",
          to: feat.properties?.to || "",
          count: Number(feat.properties?.count || 0),
          path: feat.properties?.path || "",
        });
      };
      const onRouteLeave = () => setRoutePopup(null);

      if (map.getLayer("countries-fill")) {
        map.off("click", "countries-fill", onCountryClick);
        map.on("click", "countries-fill", onCountryClick);
        map.on("mouseenter", "countries-fill", () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", "countries-fill", () => (map.getCanvas().style.cursor = ""));
      }

      if (map.getLayer("routes-line")) {
        map.off("mousemove", "routes-line", onRouteMove);
        map.on("mousemove", "routes-line", onRouteMove);
        map.off("mouseleave", "routes-line", onRouteLeave);
        map.on("mouseleave", "routes-line", onRouteLeave);
      }
    };

    if (map.isStyleLoaded()) onLoad();
    else map.once("load", onLoad);
  }, [geo, arrivals, routes, view, arrivalsMinMax.min, arrivalsMinMax.mid, arrivalsMinMax.max]);

  const switchView = (v) => {
    setView(v);
    const url = new URL(window.location.href);
    url.searchParams.set("v", v);
    window.history.replaceState({}, "", url.toString());

    if (v === "routes") setCountryPopup(null);
    if (v === "arrivals") setRoutePopup(null);

    const map = mapRef.current;
    if (!map) return;
    const isRoutes = v === "routes";
    if (map.getLayer("routes-line")) map.setLayoutProperty("routes-line", "visibility", isRoutes ? "visible" : "none");
    if (map.getLayer("routes-arrows")) map.setLayoutProperty("routes-arrows", "visibility", isRoutes ? "visible" : "none");
    if (map.getLayer("countries-fill")) map.setPaintProperty("countries-fill", "fill-opacity", isRoutes ? 0.15 : 0.75);
  };

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden" }}>
      <div ref={mapDivRef} style={{ position: "absolute", inset: 0 }} />

      {/* bal felső gombok */}
      <div
        style={{
          position: "absolute",
          left: 16,
          top: 16,
          display: "flex",
          gap: 8,
          background: "rgba(255,255,255,0.9)",
          borderRadius: 14,
          padding: 8,
          boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
          backdropFilter: "blur(8px)",
        }}
      >
        <button
          onClick={() => switchView("arrivals")}
          style={{
            border: "1px solid rgba(0,0,0,0.1)",
            padding: "8px 12px",
            borderRadius: 12,
            fontWeight: 700,
            background: view === "arrivals" ? "#111827" : "white",
            color: view === "arrivals" ? "white" : "#111827",
            cursor: "pointer",
          }}
        >
          Érkezések
        </button>
        <button
          onClick={() => switchView("routes")}
          style={{
            border: "1px solid rgba(0,0,0,0.1)",
            padding: "8px 12px",
            borderRadius: 12,
            fontWeight: 700,
            background: view === "routes" ? "#111827" : "white",
            color: view === "routes" ? "white" : "#111827",
            cursor: "pointer",
          }}
        >
          Útvonalak
        </button>
      </div>

      {/* jobb panel */}
      <div
        style={{
          position: "absolute",
          right: 16,
          top: 16,
          width: 320,
          maxHeight: "calc(100vh - 32px)",
          overflow: "auto",
          background: "rgba(255,255,255,0.92)",
          borderRadius: 18,
          padding: 14,
          boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 10 }}>
          {view === "arrivals" ? "Érkezések" : "Érkezések (halványítva)"}
        </div>

        <div style={{ marginBottom: 14 }}>
          <div
            style={{
              height: 12,
              borderRadius: 999,
              background: "linear-gradient(90deg, #fde0dd, #fcae91, #fb6a4a)",
              border: "1px solid rgba(0,0,0,0.08)",
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, color: "#374151" }}>
            <span>{fmt(arrivalsMinMax.min)}</span>
            <span>{fmt(arrivalsMinMax.mid)}</span>
            <span>{fmt(arrivalsMinMax.max)}</span>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>Vonalvastagság</div>
          {[
            { label: "50 000 fő", w: 3.5 },
            { label: "120 000 fő", w: 6 },
            { label: "250 000 fő", w: 9 },
          ].map((it) => (
            <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{ height: it.w, width: 60, background: "#ef4444", borderRadius: 999, opacity: 0.85 }} />
              <div style={{ color: "#111827", fontWeight: 700 }}>{it.label}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>Top 10 (érkezések)</div>
        <div style={{ display: "grid", gap: 8 }}>
          {top10.map((x, i) => (
            <div
              key={x.iso2}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                border: "1px solid rgba(0,0,0,0.08)",
                borderRadius: 14,
                padding: "10px 12px",
                background: "rgba(255,255,255,0.9)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 10,
                    background: "rgba(0,0,0,0.05)",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 900,
                  }}
                >
                  {i + 1}
                </div>
                <div style={{ fontWeight: 900 }}>{x.iso2}</div>
              </div>
              <div style={{ fontWeight: 900 }}>{fmt(x.value)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ország buborék */}
      {countryPopup && (
        <div
          style={{
            position: "absolute",
            left: 160,
            top: 120,
            background: "rgba(255,255,255,0.95)",
            borderRadius: 14,
            padding: 12,
            boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
            border: "1px solid rgba(0,0,0,0.08)",
            minWidth: 200,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{countryPopup.name}</div>
            <button
              onClick={() => setCountryPopup(null)}
              style={{
                border: "1px solid rgba(0,0,0,0.15)",
                background: "white",
                borderRadius: 10,
                width: 26,
                height: 26,
                cursor: "pointer",
                fontWeight: 900,
              }}
              title="Bezár"
            >
              ×
            </button>
          </div>
          <div style={{ marginTop: 6, color: "#111827" }}>
            Érkezések: <b>{fmt(countryPopup.value)}</b>
          </div>
          <div style={{ marginTop: 4, color: "#6b7280" }}>Kód: {countryPopup.iso2}</div>
        </div>
      )}

      {/* route tooltip */}
      {routePopup && view === "routes" && (
        <div
          style={{
            position: "absolute",
            left: 16,
            bottom: 16,
            background: "rgba(255,255,255,0.95)",
            borderRadius: 14,
            padding: 12,
            boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
            border: "1px solid rgba(0,0,0,0.08)",
            minWidth: 260,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 6 }}>Útvonal</div>
          <div style={{ color: "#111827" }}>
            {routePopup.from} → {routePopup.to}
          </div>
          <div style={{ color: "#111827" }}>
            Becsült: <b>{fmt(routePopup.count)}</b> fő
          </div>
          {routePopup.path ? <div style={{ color: "#6b7280", marginTop: 4 }}>{routePopup.path}</div> : null}
        </div>
      )}
    </div>
  );
}
