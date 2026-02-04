// src/Map.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// segéd: ez kezeli a GitHub Pages base path-et (pl. /migracio-terkep/)
const asset = (p) => `${import.meta.env.BASE_URL}${p}`;

// segéd: szám formázás
const fmt = (n) => {
  const x = Number(n ?? 0);
  return x.toLocaleString("hu-HU");
};

// segéd: ISO2 kinyerés több lehetséges property névből
const getIso2 = (props = {}) =>
  props.ISO2 || props.CNTR_ID || props.ISO_A2 || props.iso2 || props.cntr_id || props.iso_a2 || null;

export default function Map() {
  const mapRef = useRef(null);
  const mapDivRef = useRef(null);

  // view: "arrivals" vagy "routes"
  const [view, setView] = useState(() => {
    const v = new URLSearchParams(window.location.search).get("v");
    return v === "routes" ? "routes" : "arrivals";
  });

  // adat-state
  const [arrivals, setArrivals] = useState(null);
  const [routes, setRoutes] = useState(null);
  const [geo, setGeo] = useState(null);

  // tooltip/buborék state
  const [countryPopup, setCountryPopup] = useState(null); // {name, iso2, value, lngLat}
  const [routePopup, setRoutePopup] = useState(null); // {from,to,count,path,lngLat}

  // adatok betöltése
  useEffect(() => {
    let alive = true;

    (async () => {
      const [g, a, r] = await Promise.all([
        fetch(asset("data/eu_countries.geojson")).then((x) => x.json()),
        fetch(asset("data/arrivals_2025.json")).then((x) => x.json()),
        fetch(asset("data/routes_2025.json")).then((x) => x.json()),
      ]);

      if (!alive) return;

      // biztosítsunk ISO2-t minden feature-re (ha CNTR_ID/ISO_A2 van)
      const patched = {
        ...g,
        features: (g.features || []).map((f) => {
          const iso2 = getIso2(f.properties) || f.id || null;
          return {
            ...f,
            properties: { ...(f.properties || {}), ISO2: iso2 },
          };
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

  // top10 lista (érkezések)
  const top10 = useMemo(() => {
    const m = arrivals?.totalsByCountry || {};
    return Object.entries(m)
      .map(([iso2, value]) => ({ iso2, value: Number(value || 0) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [arrivals]);

  // min/max érkezés (skálához)
  const arrivalsMinMax = useMemo(() => {
    const m = arrivals?.totalsByCountry || {};
    const vals = Object.values(m).map((x) => Number(x || 0));
    if (!vals.length) return { min: 0, max: 1, mid: 1 };
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const mid = Math.round((min + max) / 2);
    return { min, mid, max };
  }, [arrivals]);

  // Map init (csak egyszer!)
  useEffect(() => {
    if (mapRef.current) return;
    if (!mapDivRef.current) return;

    const map = new maplibregl.Map({
      container: mapDivRef.current,
      // Ingyenes, stabil világos stílus
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

  // layerek felépítése, amikor megjönnek az adatok
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!geo || !arrivals || !routes) return;

    const onLoad = () => {
      // COUNTRY source (promoteId: ISO2 -> feature-state-hez)
      if (!map.getSource("countries")) {
        map.addSource("countries", {
          type: "geojson",
          data: geo,
          promoteId: "ISO2",
        });
      } else {
        map.getSource("countries").setData(geo);
      }

      // ROUTES source (GeoJSON vonalak)
      const routeFeatures = (routes?.routes || []).map((rt, idx) => ({
        type: "Feature",
        id: idx,
        properties: {
          from: rt.from,
          to: rt.to,
          count: Number(rt.count || 0),
          path: rt.path || "",
        },
        geometry: {
          type: "LineString",
          coordinates: rt.coordinates || rt.coords || [], // ha később bővíted koordinátákkal
        },
      }));

      // Ha a routes_2025.json nálad még nem tartalmaz koordinátákat,
      // akkor is tudunk "egyenes" vonalat rajzolni egy fallback koordináta-táblából a Map.jsx-ben.
      // Viszont nálad MOST már látszanak a vonalak, tehát van már valami koordináta-fallback.
      // Itt csak azokat a feature-öket tartjuk meg, ahol van coordinate.
      const filteredRouteFeatures = routeFeatures.filter(
        (f) => Array.isArray(f.geometry.coordinates) && f.geometry.coordinates.length >= 2
      );

      const routesGeojson = {
        type: "FeatureCollection",
        features: filteredRouteFeatures,
      };

      if (!map.getSource("routes")) {
        map.addSource("routes", {
          type: "geojson",
          data: routesGeojson,
        });
      } else {
        map.getSource("routes").setData(routesGeojson);
      }

      // COUNTRY fill (érkezések)
      if (!map.getLayer("countries-fill")) {
        map.addLayer({
          id: "countries-fill",
          type: "fill",
          source: "countries",
          paint: {
            // feature-state.arrivals alapján színezünk (ha nincs, 0)
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
            "fill-opacity": [
              "case",
              ["==", ["literal", view], "routes"],
              0.15,
              0.75,
            ],
          },
        });
      }

      // COUNTRY border
      if (!map.getLayer("countries-outline")) {
        map.addLayer({
          id: "countries-outline",
          type: "line",
          source: "countries",
          paint: {
            "line-color": "#ffffff",
            "line-width": 1.2,
            "line-opacity": 0.9,
          },
        });
      }

      // ROUTE line
      if (!map.getLayer("routes-line")) {
        map.addLayer({
          id: "routes-line",
          type: "line",
          source: "routes",
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
          paint: {
            "line-color": "#ef4444",
            "line-opacity": 0.85,
            // vastagság a count alapján
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

      // "Nyílhegy" finomítás: ismétlődő ► jel a vonalon (automatikusan a vonal irányába fordul)
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
            "text-letter-spacing": 0.1,
          },
          paint: {
            "text-color": "#ef4444",
            "text-opacity": 0.9,
          },
        });
      }

      // VIEW kapcsolás: csak visibility + opacity (NE tűnjön el a térkép!)
      const applyView = (v) => {
        const isRoutes = v === "routes";
        if (map.getLayer("routes-line")) {
          map.setLayoutProperty("routes-line", "visibility", isRoutes ? "visible" : "none");
        }
        if (map.getLayer("routes-arrows")) {
          map.setLayoutProperty("routes-arrows", "visibility", isRoutes ? "visible" : "none");
        }
        if (map.getLayer("countries-fill")) {
          map.setPaintProperty("countries-fill", "fill-opacity", isRoutes ? 0.15 : 0.75);
        }
      };

      applyView(view);

      // feature-state beállítás (érkezések)
      const totals = arrivals?.totalsByCountry || {};
      (geo.features || []).forEach((f) => {
        const iso2 = getIso2(f.properties);
        if (!iso2) return;
        map.setFeatureState(
          { source: "countries", id: iso2 },
          { arrivals: Number(totals[iso2] ?? 0) }
        );
      });

      // ország popup click
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
        setCountryPopup({
          name,
          iso2: iso2 || "??",
          value,
          lngLat: e.lngLat,
        });
        setRoutePopup(null);
      };

      // route tooltip hover
      const onRouteMove = (e) => {
        const feat = e.features?.[0];
        if (!feat) return;
        setRoutePopup({
          from: feat.properties?.from || "",
          to: feat.properties?.to || "",
          count: Number(feat.properties?.count || 0),
          path: feat.properties?.path || "",
          lngLat: e.lngLat,
        });
      };
      const onRouteLeave = () => setRoutePopup(null);

      // események felrakása (előtte lekapcsoljuk, hogy ne duplázódjon hot reloadnál)
      if (map.getLayer("countries-fill")) {
        map.off("click", "countries-fill", onCountryClick);
        map.on("click", "countries-fill", onCountryClick);
        map.off("mouseenter", "countries-fill", () => {});
        map.on("mouseenter", "countries-fill", () => (map.getCanvas().style.cursor = "pointer"));
        map.off("mouseleave", "countries-fill", () => {});
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

  // view váltás + URL query frissítés
  const switchView = (v) => {
    setView(v);
    const url = new URL(window.location.href);
    url.searchParams.set("v", v);
    window.history.replaceState({}, "", url.toString());

    // popupok kezelése
    if (v === "routes") setCountryPopup(null);
    if (v === "arrivals") setRoutePopup(null);

    // layerek azonnali állítása (ne várjunk a useEffect-re)
    const map = mapRef.current;
    if (!map) return;
    const isRoutes = v === "routes";
    if (map.getLayer("routes-line")) map.setLayoutProperty("routes-line", "visibility", isRoutes ? "visible" : "none");
    if (map.getLayer("routes-arrows")) map.setLayoutProperty("routes-arrows", "visibility", isRoutes ? "visible" : "none");
    if (map.getLayer("countries-fill")) map.setPaintProperty("countries-fill", "fill-opacity", isRoutes ? 0.15 : 0.75);
  };

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden" }}>
      {/* MAP */}
      <div ref={mapDivRef} style={{ position: "absolute", inset: 0 }} />

      {/* BAL FELSŐ: gombok */}
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

      {/* JOBB OLDALI PANEL: skála + vonalvastagság + top10 */}
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

        {/* Oldalsó skála (szín) */}
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

        {/* Vonalvastagság magyarázat */}
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

        {/* Top 10 panel */}
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

        <div style={{ marginTop: 12, color: "#6b7280", fontSize: 12 }}>
          Tipp: kattints országra az értékhez (Érkezések), vagy vidd az egeret a vonalak fölé (Útvonalak).
        </div>
      </div>

      {/* COUNTRY popup (React alapú “buborék”) */}
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

      {/* ROUTE tooltip */}
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
