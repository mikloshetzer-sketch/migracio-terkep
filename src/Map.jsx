import { useEffect, useState } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const DATA_URL = "./data/arrivals_2025.json";
const GEO_URL = "./data/eu_countries.geojson";

export default function Map() {
  const [geoData, setGeoData] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetch(GEO_URL)
      .then((r) => r.json())
      .then(setGeoData);

    fetch(DATA_URL)
      .then((r) => r.json())
      .then(setStats);
  }, []);

  function getValue(feature) {
    if (!stats) return 0;
    const code = feature.properties.ISO3_CODE;
    return stats.totalsByCountry[code] || 0;
  }

  function getColor(v) {
    return v > 200000
      ? "#800026"
      : v > 100000
      ? "#BD0026"
      : v > 50000
      ? "#E31A1C"
      : v > 20000
      ? "#FC4E2A"
      : v > 10000
      ? "#FD8D3C"
      : v > 5000
      ? "#FEB24C"
      : "#FFEDA0";
  }

  function style(feature) {
    const v = getValue(feature);
    return {
      fillColor: getColor(v),
      weight: 1,
      opacity: 1,
      color: "#555",
      fillOpacity: 0.7,
    };
  }

  function onEachFeature(feature, layer) {
    const name = feature.properties.NAME_ENGL;
    const value = getValue(feature);
    layer.bindTooltip(`${name}: ${value.toLocaleString()} fő`, {
      sticky: true,
    });
  }

  return (
    <MapContainer
      center={[52, 13]}
      zoom={4}
      style={{ height: "100vh", width: "100%" }}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {geoData && (
        <GeoJSON
          data={geoData}
          style={style}
          onEachFeature={onEachFeature}
        />
      )}
    </MapContainer>
  );
}
