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

    map.on("load", () => {
      map.addSource("migration-corridors", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {
                name: "Central Mediterranean Route",
                pressure: 86
              },
              geometry: {
                type: "LineString",
                coordinates: [
                  [13.1, 32.8],
                  [12.5, 35.8],
                  [12.4, 37.6],
                  [14.3, 40.8]
                ]
              }
            },
            {
              type: "Feature",
              properties: {
                name: "Eastern Mediterranean Route",
                pressure: 72
              },
              geometry: {
                type: "LineString",
                coordinates: [
                  [35.2, 36.7],
                  [29.0, 38.4],
                  [24.9, 39.1],
                  [22.9, 40.6],
                  [20.4, 44.8],
                  [19.0, 47.5]
                ]
              }
            },
            {
              type: "Feature",
              properties: {
                name: "Western Balkan Route",
                pressure: 61
              },
              geometry: {
                type: "LineString",
                coordinates: [
                  [21.4, 41.9],
                  [20.5, 44.1],
                  [19.8, 45.3],
                  [19.0, 46.1],
                  [19.0, 47.5]
                ]
              }
            }
          ]
        }
      });

      map.addLayer({
        id: "migration-corridors-line",
        type: "line",
        source: "migration-corridors",
        paint: {
          "line-color": "#58d6ff",
          "line-width": [
            "interpolate",
            ["linear"],
            ["get", "pressure"],
            40,
            3,
            90,
            9
          ],
          "line-opacity": 0.85
        }
      });

      map.addLayer({
        id: "migration-corridors-glow",
        type: "line",
        source: "migration-corridors",
        paint: {
          "line-color": "#4cc9f0",
          "line-width": [
            "interpolate",
            ["linear"],
            ["get", "pressure"],
            40,
            8,
            90,
            20
          ],
          "line-opacity": 0.18
        }
      });

      map.addSource("hotspots", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: { name: "Libya / Tunisia", pressure: 86 },
              geometry: { type: "Point", coordinates: [13.1, 32.8] }
            },
            {
              type: "Feature",
              properties: { name: "Türkiye / Eastern Med", pressure: 72 },
              geometry: { type: "Point", coordinates: [29.0, 38.4] }
            },
            {
              type: "Feature",
              properties: { name: "Western Balkans", pressure: 61 },
              geometry: { type: "Point", coordinates: [20.5, 44.1] }
            },
            {
              type: "Feature",
              properties: { name: "Hungary", pressure: 49 },
              geometry: { type: "Point", coordinates: [19.0, 47.5] }
            }
          ]
        }
      });

      map.addLayer({
        id: "hotspot-circles",
        type: "circle",
        source: "hotspots",
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["get", "pressure"],
            40,
            8,
            90,
            18
          ],
          "circle-color": "#ef4444",
          "circle-opacity": 0.75,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1
        }
      });

      map.on("click", "hotspot-circles", (event) => {
        const feature = event.features[0];

        new maplibregl.Popup()
          .setLngLat(feature.geometry.coordinates)
          .setHTML(`
            <strong>${feature.properties.name}</strong><br/>
            Pressure score: ${feature.properties.pressure}/100
          `)
          .addTo(map);
      });

      map.on("mouseenter", "hotspot-circles", () => {
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", "hotspot-circles", () => {
        map.getCanvas().style.cursor = "";
      });
    });
  }, []);

  return <div className="global-map" ref={mapContainer} />;
}

export default GlobalMap;
