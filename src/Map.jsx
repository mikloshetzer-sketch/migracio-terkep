import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// Segéd: biztonságos base URL GitHub Pages-hez is
const base = (p) => `${import.meta.env.BASE_URL}${p}`;

// Egyszerű színskála (0..max) – MapLibre "interpolate" expressionnel
function makeFillExpression(maxVal) {
  // maxVal=0 eset
  const m = Math.max(1, Number(maxVal) || 1);

  // interpolate lineárisan 0..m között
  // (nem állítunk be "matplotlib-szerű" dolgokat, itt csak MapLibre színek)
  return [
    "interpolate",
    ["linear"],
    ["coalesce", ["get", "value"], 0],
    0, "#f2f0f7",
    m * 0.1, "#dadaeb",
    m * 0.25, "#bcbddc",
    m * 0.5, "#9e9ac8",
    m * 0.75, "#756bb1",
    m, "#54278f",
  ];
}

// Pár országközéppont (lon, lat) route-vonalakhoz.
// Bővíthető később, de már működik.
const CENTROIDS = {
  // EU célországok (ISO2)
  GR: [22.95, 39.1],
  IT: [12.5, 42.9],
  ES: [-3.7, 40.4],
  FR: [2.2, 46.2],
  DE: [10.45, 51.16],
  AT: [14.55, 47.52],
  HU: [19.04, 47.5],
  PL: [19.15, 52.1],
  NL: [5.3, 52.1],
  BE: [4.6, 50.8],
  SE: [15.0, 62.0],
  DK: [10.0, 56.2],
  // Forrás / tranzit (ISO2)
  SY: [38.99, 34.8],
  TR: [35.2, 39.0],
  AF: [66.0, 33.9],
  IQ: [43.7, 33.2],
  IR: [53.7, 32.5],
  PK: [69.3, 30.4],
  LY: [17.2, 26.3],
  TN: [9.5, 34.0],
  DZ: [2.6, 28.0],
  MA: [-6.0, 31.8],
};

// routes.json -> GeoJSON LineString-ek
function routesToGeoJSON(routesJson) {
  const feats = [];
  const routes = routesJson?.routes || [];

  for (const r of routes) {
    const from = r.from;
    const to = r.to;
    const count = Number(r.count) || 0;

    const a = CENTROIDS[from];
    const b = CENTROIDS[to];
    if (!a || !b) continue;

    feats.push({
      type: "Feature",
      properties: {
        from,
        to,
        count,
        path: r.path || "",
      },
      geometry: {
        type: "LineString",
        coordinates: [a, b],
      },
    });
  }

  return { type: "FeatureCollection", features: feats };
}

export default function Map() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      // OSM-alapú stílus (stabil, gyors)
      style: "https://demotiles.maplibre.org/style.json",
      center: [12, 50],
      zoom: 3.5,
    });

    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

    const popup = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: true,
    });

    async function initLayers() {
      // 1) országpoligonok (GeoJSON)
      const countriesUrl = base("data/eu_countries.geojson");
      const arrivalsUrl = base("data/arrivals_2025.json");
      const routesUrl = base("data/routes_2025.json");

      const [countriesRes, arrivalsRes, routesRes] = await Promise.all([
        fetch(countriesUrl),
        fetch(arrivalsUrl),
        fetch(routesUrl),
      ]);

      if (!countriesRes.ok) throw new Error(`Cannot load eu_countries.geojson (${countriesRes.status})`);
      if (!arrivalsRes.ok) throw new Error(`Cannot load arrivals_2025.json (${arrivalsRes.status})`);
      if (!routesRes.ok) throw new Error(`Cannot load routes_2025.json (${routesRes.status})`);

      const countries = await countriesRes.json();
      const arrivals = await arrivalsRes.json();
      const routes = await routesRes.json();

      // 2) Érkezések ráégetése a poligonokra (CNTR_ID vagy ISO2_CODE alapján)
      const totals = arrivals?.totalsByCountry || {};
      let maxVal = 0;

      for (const f of countries.features || []) {
        const p = f.properties || {};
        // GISCO-ban gyakori: CNTR_ID (2 betű), ISO2_CODE (2 betű), ISO3_CODE (3 betű)
        const iso2 = p.CNTR_ID || p.ISO2_CODE || p.ISO2 || p.CNTRID;
        const v = Number(totals?.[iso2]) || 0;
        f.properties = { ...p, iso2, value: v };
        if (v > maxVal) maxVal = v;
      }

      // 3) Források felvétele
      if (!map.getSource("eu-countries")) {
        map.addSource("eu-countries", {
          type: "geojson",
          data: countries,
        });
      } else {
        map.getSource("eu-countries").setData(countries);
      }

      const routesGeo = routesToGeoJSON(routes);

      if (!map.getSource("routes")) {
        map.addSource("routes", {
          type: "geojson",
          data: routesGeo,
        });
      } else {
        map.getSource("routes").setData(routesGeo);
      }

      // 4) Rétegek (ha még nincsenek)
      if (!map.getLayer("countries-fill")) {
        map.addLayer({
          id: "countries-fill",
          type: "fill",
          source: "eu-countries",
          paint: {
            "fill-color": makeFillExpression(maxVal),
            "fill-opacity": 0.75,
          },
        });
      } else {
        // frissítjük a színskálát, ha változott
        map.setPaintProperty("countries-fill", "fill-color", makeFillExpression(maxVal));
      }

      if (!map.getLayer("countries-outline")) {
        map.addLayer({
          id: "countries-outline",
          type: "line",
          source: "eu-countries",
          paint: {
            "line-color": "#ffffff",
            "line-width": 1,
          },
        });
      }

      if (!map.getLayer("routes-line")) {
        map.addLayer({
          id: "routes-line",
          type: "line",
          source: "routes",
          paint: {
            "line-color": "#111827",
            "line-width": [
              "interpolate",
              ["linear"],
              ["coalesce", ["get", "count"], 0],
              0, 0.5,
              50000, 2,
              200000, 5,
            ],
            "line-opacity": 0.65,
          },
        });
      }

      // 5) Interakció: ország hover/click
      map.on("mousemove", "countries-fill", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const f = e.features?.[0];
        if (!f) return;

        const name =
          f.properties?.CNTR_NAME ||
          f.properties?.NAME_ENGL ||
          f.properties?.name ||
          f.properties?.iso2 ||
          "Unknown";

        const value = Number(f.properties?.value) || 0;

        popup
          .setLngLat(e.lngLat)
          .setHTML(`<div style="font-family:system-ui; font-size:13px;">
              <div style="font-weight:700; margin-bottom:6px;">${name}</div>
              <div><b>Value:</b> ${value.toLocaleString("hu-HU")}</div>
            </div>`)
          .addTo(map);
      });

      map.on("mouseleave", "countries-fill", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });
    }

    map.on("load", () => {
      initLayers().catch((err) => {
        console.error(err);
        // ha baj van, legalább a térkép maradjon
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return <div ref={mapContainer} style={{ width: "100vw", height: "100vh" }} />;
}
