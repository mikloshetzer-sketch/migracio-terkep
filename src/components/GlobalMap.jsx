import React, { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

function GlobalMap() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://demotiles.maplibre.org/style.json",
      center: [18, 39],
      zoom: 3.2
    });

    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", async () => {
      try {
        const corridorResponse = await fetch(
          `${import.meta.env.BASE_URL}data/derived/corridors.geojson`
        );

        if (!corridorResponse.ok) {
          throw new Error("Generated corridors file not available");
        }

        const corridors = await corridorResponse.json();

        map.addSource("corridors", {
          type: "geojson",
          data: corridors
        });

        map.addLayer({
          id: "corridor-glow",
          type: "line",
          source: "corridors",
          paint: {
            "line-color": [
              "match",
              ["get", "risk"],
              "critical",
              "#ef4444",
              "high",
              "#f59e0b",
              "elevated",
              "#58d6ff",
              "moderate",
              "#4cc9f0",
              "#9fb2c8"
            ],
            "line-width": [
              "interpolate",
              ["linear"],
              ["get", "pressure"],
              30,
              6,
              90,
              22
            ],
            "line-opacity": 0.18
          }
        });

        map.addLayer({
          id: "corridor-line",
          type: "line",
          source: "corridors",
          paint: {
            "line-color": [
              "match",
              ["get", "risk"],
              "critical",
              "#ef4444",
              "high",
              "#f59e0b",
              "elevated",
              "#58d6ff",
              "moderate",
              "#4cc9f0",
              "#9fb2c8"
            ],
            "line-width": [
              "interpolate",
              ["linear"],
              ["get", "pressure"],
              30,
              2,
              90,
              8
            ],
            "line-opacity": 0.9
          }
        });

        const hotspotResponse = await fetch(
          `${import.meta.env.BASE_URL}data/hotspots.geojson`
        );

        if (hotspotResponse.ok) {
          const hotspots = await hotspotResponse.json();

          map.addSource("hotspots", {
            type: "geojson",
            data: hotspots
          });

          map.addLayer({
            id: "hotspots-circle",
            type: "circle",
            source: "hotspots",
            paint: {
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["get", "pressure"],
                40,
                7,
                90,
                18
              ],
              "circle-color": [
                "match",
                ["get", "level"],
                "Critical",
                "#ef4444",
                "High",
                "#f59e0b",
                "Elevated",
                "#58d6ff",
                "Moderate",
                "#4cc9f0",
                "#9fb2c8"
              ],
              "circle-opacity": 0.82,
              "circle-stroke-width": 1,
              "circle-stroke-color": "#ffffff"
            }
          });

          map.on("click", "hotspots-circle", (event) => {
            const feature = event.features[0];

            new maplibregl.Popup()
              .setLngLat(feature.geometry.coordinates)
              .setHTML(`
                <strong>${feature.properties.name}</strong><br/>
                Level: ${feature.properties.level}<br/>
                Pressure: ${feature.properties.pressure}/100
              `)
              .addTo(map);
          });

          map.on("mouseenter", "hotspots-circle", () => {
            map.getCanvas().style.cursor = "pointer";
          });

          map.on("mouseleave", "hotspots-circle", () => {
            map.getCanvas().style.cursor = "";
          });
        }

        map.on("click", "corridor-line", (event) => {
          const feature = event.features[0];

          new maplibregl.Popup()
            .setLngLat(event.lngLat)
            .setHTML(`
              <strong>${feature.properties.path}</strong><br/>
              ${feature.properties.from} → ${feature.properties.to}<br/>
              Count: ${Number(feature.properties.count).toLocaleString()} people<br/>
              Pressure: ${feature.properties.pressure}/100<br/>
              Risk: ${feature.properties.risk}
            `)
            .addTo(map);
        });

        map.on("mouseenter", "corridor-line", () => {
          map.getCanvas().style.cursor = "pointer";
        });

        map.on("mouseleave", "corridor-line", () => {
          map.getCanvas().style.cursor = "";
        });
      } catch (error) {
        console.error("GlobalMap data loading error:", error);
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return <div className="global-map" ref={mapContainer} />;
}

export default GlobalMap;
