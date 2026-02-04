import { useEffect, useRef } from "react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"

export default function Map() {
  const mapContainer = useRef(null)
  const map = useRef(null)

  useEffect(() => {
    if (map.current) return

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://demotiles.maplibre.org/style.json",
      center: [15, 50],
      zoom: 4
    })

    const BASE = "/migracio-terkep/data"

    map.current.on("load", async () => {
      // ---------------------------
      // LOAD DATA FILES
      // ---------------------------
      const [euRes, arrivalsRes, routesRes] = await Promise.all([
        fetch(`${BASE}/eu_countries.geojson`),
        fetch(`${BASE}/arrivals_2025.json`),
        fetch(`${BASE}/routes_2025.json`)
      ])

      const euData = await euRes.json()
      const arrivalsData = await arrivalsRes.json()
      const routesData = await routesRes.json()

      // ---------------------------
      // EU COUNTRIES LAYER
      // ---------------------------
      map.current.addSource("eu", {
        type: "geojson",
        data: euData
      })

      map.current.addLayer({
        id: "eu-fill",
        type: "fill",
        source: "eu",
        paint: {
          "fill-color": "#e6e6e6",
          "fill-opacity": 0.6
        }
      })

      map.current.addLayer({
        id: "eu-borders",
        type: "line",
        source: "eu",
        paint: {
          "line-color": "#333",
          "line-width": 1
        }
      })

      // ---------------------------
      // TOOLTIP
      // ---------------------------
      const popup = new maplibregl.Popup({
        closeButton: true,
        closeOnClick: true
      })

      map.current.on("click", "eu-fill", e => {
        const props = e.features[0].properties
        const code = props.ISO2 || props.CNTR_ID
        const value = arrivalsData.totalsByCountry[code] || 0

        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<b>${props.NAME || "Unknown"}</b><br/>Arrivals 2025: ${value.toLocaleString()}`
          )
          .addTo(map.current)
      })

      // ---------------------------
      // ROUTES → GEOJSON
      // ---------------------------
      const centroids = {}
      euData.features.forEach(f => {
        const code = f.properties.ISO2 || f.properties.CNTR_ID
        const coords = f.geometry.coordinates.flat(2)

        let lng = 0
        let lat = 0
        coords.forEach(c => {
          lng += c[0]
          lat += c[1]
        })

        centroids[code] = [lng / coords.length, lat / coords.length]
      })

      const routeFeatures = routesData.routes
        .map(r => {
          if (!centroids[r.from] || !centroids[r.to]) return null

          return {
            type: "Feature",
            properties: {
              count: r.count,
              path: r.path
            },
            geometry: {
              type: "LineString",
              coordinates: [
                centroids[r.from],
                centroids[r.to]
              ]
            }
          }
        })
        .filter(Boolean)

      const routesGeoJSON = {
        type: "FeatureCollection",
        features: routeFeatures
      }

      // ---------------------------
      // ROUTE LAYER
      // ---------------------------
      map.current.addSource("routes", {
        type: "geojson",
        data: routesGeoJSON
      })

      map.current.addLayer({
        id: "routes-line",
        type: "line",
        source: "routes",
        paint: {
          "line-color": "#ff3b3b",
          "line-width": [
            "interpolate",
            ["linear"],
            ["get", "count"],
            1000,
            1,
            50000,
            4,
            150000,
            8
          ],
          "line-opacity": 0.85
        }
      })
    })
  }, [])

  return (
    <div
      ref={mapContainer}
      style={{ width: "100vw", height: "100vh" }}
    />
  )
}
