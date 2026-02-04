import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export default function Map() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);

  useEffect(() => {
    if (mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://demotiles.maplibre.org/style.json",
      center: [12, 50],
      zoom: 3.6,
    });

    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    const base = import.meta.env.BASE_URL; // pl. /migracio-terkep/
    const urlCountries = `${base}data/eu_countries.geojson`;
    const urlArrivals = `${base}data/arrivals_2025.json`;
    const urlRoutes = `${base}data/routes_2025.json`;

    // egyszerű centroid (közelítő, de vizuálisan ok)
    function centroidOfFeature(feat) {
      const g = feat.geometry;
      if (!g) return null;

      // flatten koordináták
      const coords = [];
      const pushRing = (ring) => {
        for (const p of ring) coords.push(p);
      };

      if (g.type === "Polygon") {
        for (const ring of g.coordinates) pushRing(ring);
      } else if (g.type === "MultiPolygon") {
        for (const poly of g.coordinates) {
          for (const ring of poly) pushRing(ring);
        }
      } else {
        return null;
      }

      if (!coords.length) return null;

      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;

      for (const [x, y] of coords) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
      return [(minX + maxX) / 2, (minY + maxY) / 2];
    }

    map.on("load", async () => {
      // 1) betöltések
      const [countriesRes, arrivalsRes, routesRes] = await Promise.all([
        fetch(urlCountries),
        fetch(urlArrivals),
        fetch(urlRoutes),
      ]);

      const countries = await countriesRes.json();
      const arrivals = await arrivalsRes.json();
      const routesJson = await routesRes.json();

      // arrivals: { totalsByCountry: { "BE": 123, ... } }
      const totals = arrivals?.totalsByCountry || {};

      // 2) országok source + layer
      map.addSource("countries", {
        type: "geojson",
        data: countries,
        // nagyon fontos: azonosító, amire a feature-state megy
        promoteId: "CNTR_ID",
      });

      map.addLayer({
        id: "countries-fill",
        type: "fill",
        source: "countries",
        paint: {
          "fill-outline-color": "#ffffff",
          "fill-opacity": 0.75,
          // színezés value alapján (feature-state.value)
          "fill-color": [
            "interpolate",
            ["linear"],
            ["coalesce", ["feature-state", "value"], 0],
            0,
            "#f2f2f2",
            1,
            "#cfe8ff",
            1000,
            "#8cc8ff",
            5000,
            "#4aa6ff",
            20000,
            "#006dff",
          ],
        },
      });

      map.addLayer({
        id: "countries-line",
        type: "line",
        source: "countries",
        paint: {
          "line-color": "#ffffff",
          "line-width": 1,
          "line-opacity": 0.9,
        },
      });

      // 3) beállítjuk a value-kat feature-state-be CNTR_ID alapján
      for (const [iso2, value] of Object.entries(totals)) {
        map.setFeatureState(
          { source: "countries", id: iso2 },
          { value: Number(value) || 0 }
        );
      }

      // 4) route vonalak generálása ország-centroidokból
      const centroidById = new Map();
      for (const f of countries.features || []) {
        const id = f?.properties?.CNTR_ID;
        if (!id) continue;
        const c = centroidOfFeature(f);
        if (c) centroidById.set(id, c);
      }

      const routes = routesJson?.routes || [];
      const routeFeatures = [];

      for (const r of routes) {
        const from = r.from;
        const to = r.to;
        const count = Number(r.count) || 0;

        const a = centroidById.get(from);
        const b = centroidById.get(to);
        if (!a || !b) continue;

        routeFeatures.push({
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

      map.addSource("routes", {
        type: "geojson",
        data: { type: "FeatureCollection", features: routeFeatures },
      });

      map.addLayer({
        id: "routes-line",
        type: "line",
        source: "routes",
        paint: {
          "line-color": "#111111",
          "line-opacity": 0.6,
          "line-width": [
            "interpolate",
            ["linear"],
            ["get", "count"],
            0,
            1,
            10000,
            2,
            50000,
            4,
            200000,
            7,
          ],
        },
      });

      // 5) hover popup országokra
      popupRef.current = new maplibregl.Popup({
        closeButton: true,
        closeOnClick: false,
      });

      map.on("mousemove", "countries-fill", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const f = e.features?.[0];
        if (!f) return;

        const props = f.properties || {};
        const name =
          props.NAME_ENGL ||
          props.CNTR_NAME ||
          props.NAME ||
          props.CNTR_ID ||
          "Unknown";

        const st = map.getFeatureState({ source: "countries", id: props.CNTR_ID });
        const value = Number(st?.value ?? 0);

        popupRef.current
          .setLngLat(e.lngLat)
          .setHTML(`<b>${name}</b><br/>Value: ${value}`)
          .addTo(map);
      });

      map.on("mouseleave", "countries-fill", () => {
        map.getCanvas().style.cursor = "";
        popupRef.current?.remove();
      });
    });

    return () => {
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return <div ref={mapContainer} style={{ width: "100vw", height: "100vh" }} />;
}
