import { useEffect, useRef } from "react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"

// BBOX centroid (gyors, stabil multipolygonhoz is)
function bboxCentroid(geometry) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

  const walk = (coords) => {
    if (!Array.isArray(coords)) return
    if (typeof coords[0] === "number" && typeof coords[1] === "number") {
      const x = coords[0], y = coords[1]
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
      return
    }
    for (const c of coords) walk(c)
  }

  walk(geometry.coordinates)

  if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
    return null
  }
  return [(minX + maxX) / 2, (minY + maxY) / 2]
}

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

    // GitHub Pages alatti biztos base path:
    const BASE = "/migracio-terkep/data"

    // Nem-EU országok “from” koordinátái (bővíthető!)
    // (Kb. főváros / országközép – a vizuálhoz elég pontos.)
    const ORIGIN_COORDS = {
      SY: [36.2765, 33.5138], // Syria (Damascus)
      TR: [32.8597, 39.9334], // Turkey (Ankara)
      LB: [35.5018, 33.8938], // Lebanon (Beirut)
      JO: [35.9304, 31.9516], // Jordan (Amman)
      IQ: [44.3661, 33.3152], // Iraq (Baghdad)
      IR: [51.3890, 35.6892], // Iran (Tehran)
      AF: [69.2075, 34.5553], // Afghanistan (Kabul)
      PK: [73.0479, 33.6844], // Pakistan (Islamabad)

      EG: [31.2357, 30.0444], // Egypt (Cairo)
      LY: [13.1913, 32.8872], // Libya (Tripoli)
      TN: [10.1815, 36.8065], // Tunisia (Tunis)
      DZ: [3.0588, 36.7538],  // Algeria (Algiers)
      MA: [-6.8498, 34.0209], // Morocco (Rabat)

      NG: [7.3986, 9.0765],   // Nigeria (Abuja)
      NE: [2.1098, 13.5116],  // Niger (Niamey)
      ML: [-8.0029, 12.6392], // Mali (Bamako)
      SN: [-17.4677, 14.7167] // Senegal (Dakar)
    }

    map.current.on("load", async () => {
      const [euRes, arrivalsRes, routesRes] = await Promise.all([
        fetch(`${BASE}/eu_countries.geojson`),
        fetch(`${BASE}/arrivals_2025.json`),
        fetch(`${BASE}/routes_2025.json`)
      ])

      const euData = await euRes.json()
      const arrivalsData = await arrivalsRes.json()
      const routesData = await routesRes.json()

      // EU centroidok (bbox-közép)
      const centroids = {}
      for (const f of euData.features) {
        const code = f.properties?.CNTR_ID // GISCO-ban ez a 2 betűs (AT, DE, ...)
        const c = bboxCentroid(f.geometry)
        if (code && c) centroids[code] = c
      }

      // EU layer
      map.current.addSource("eu", { type: "geojson", data: euData })

      map.current.addLayer({
        id: "eu-fill",
        type: "fill",
        source: "eu",
        paint: { "fill-color": "#e6e6e6", "fill-opacity": 0.55 }
      })

      map.current.addLayer({
        id: "eu-borders",
        type: "line",
        source: "eu",
        paint: { "line-color": "#333", "line-width": 1 }
      })

      // Tooltip (arrivals)
      const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true })

      map.current.on("click", "eu-fill", (e) => {
        const props = e.features?.[0]?.properties || {}
        const code = props.CNTR_ID
        const value = arrivalsData?.totalsByCountry?.[code] ?? 0

        popup
          .setLngLat(e.lngLat)
          .setHTML(`<b>${props.CNTR_NAME || props.NAME_ENGL || code || "Unknown"}</b><br/>Arrivals 2025: ${Number(value).toLocaleString()}`)
          .addTo(map.current)
      })

      // ROUTES → GeoJSON (from: ORIGIN_COORDS vagy EU centroid, to: EU centroid)
      const routeFeatures = (routesData.routes || [])
        .map((r) => {
          const from = ORIGIN_COORDS[r.from] || centroids[r.from]
          const to = centroids[r.to]
          if (!from || !to) return null

          return {
            type: "Feature",
            properties: {
              count: r.count || 0,
              path: r.path || ""
            },
            geometry: {
              type: "LineString",
              coordinates: [from, to]
            }
          }
        })
        .filter(Boolean)

      const routesGeoJSON = {
        type: "FeatureCollection",
        features: routeFeatures
      }

      map.current.addSource("routes", { type: "geojson", data: routesGeoJSON })

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
            1000, 1,
            50000, 4,
            150000, 8
          ],
          "line-opacity": 0.85
        }
      })
    })
  }, [])

  return <div ref={mapContainer} style={{ width: "100vw", height: "100vh" }} />
}
