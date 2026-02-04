import { useEffect, useRef } from "react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"

// --- CODE NORMALIZATION (very important for GISCO) ---
// GISCO sometimes uses EL (Greece), UK (United Kingdom), etc.
const CODE_ALIASES = {
  GR: "EL", // Greece
  GB: "UK", // UK
  // if you ever use: XK (Kosovo) sometimes appears as KO in some datasets - depends on your geojson
}

function norm(code) {
  if (!code) return code
  const c = String(code).toUpperCase().trim()
  return CODE_ALIASES[c] || c
}

function getAllCoords(geom) {
  const out = []
  const walk = (x) => {
    if (!x) return
    if (typeof x[0] === "number" && typeof x[1] === "number") {
      out.push([x[0], x[1]])
      return
    }
    for (const y of x) walk(y)
  }
  walk(geom.coordinates)
  return out
}

function centroidOfFeatureBBox(f) {
  const pts = getAllCoords(f.geometry)
  if (!pts.length) return null
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of pts) {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
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

    const BASE = "/migracio-terkep/data"

    // Origins outside EU (so routes can start from MENA etc.)
    const ORIGIN_POINTS = {
      // Middle East
      SY: [38.9968, 34.8021],
      TR: [35.2433, 38.9637],
      LB: [35.8623, 33.8547],
      JO: [36.2384, 30.5852],
      IQ: [43.6793, 33.2232],
      IR: [53.6880, 32.4279],
      AF: [67.7099, 33.9391],
      PK: [69.3451, 30.3753],

      // North Africa
      EG: [30.8025, 26.8206],
      LY: [17.2283, 26.3351],
      TN: [9.5375, 33.8869],
      DZ: [1.6596, 28.0339],
      MA: [-7.0926, 31.7917],

      // Sub-Sahara examples
      NE: [8.0817, 17.6078],
      NG: [8.6753, 9.0820],
      SD: [30.2176, 12.8628],
      ET: [40.4897, 9.1450]
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

      // EU polygons
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

      // Build centroid table (normalized keys!)
      const centroids = {}
      for (const f of euData.features) {
        const raw = f.properties?.ISO2 || f.properties?.CNTR_ID
        const code = norm(raw)
        const c = centroidOfFeatureBBox(f)
        if (code && c) centroids[code] = c
      }

      // Tooltip
      const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true })

      map.current.on("click", "eu-fill", (e) => {
        const props = e.features?.[0]?.properties || {}
        const raw = props.ISO2 || props.CNTR_ID
        const code = norm(raw)

        // arrivals file may be GR while map uses EL -> normalize both sides
        const totals = arrivalsData?.totalsByCountry || {}
        const value =
          totals[code] ??
          totals[Object.keys(CODE_ALIASES).find((k) => norm(k) === code) || ""] ??
          0

        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<b>${props.NAME || props.NAME_ENGL || "Unknown"}</b><br/>Arrivals 2025: ${Number(value).toLocaleString()}`
          )
          .addTo(map.current)
      })

      // Routes GeoJSON (normalize from/to!)
      const routeFeatures = (routesData?.routes || [])
        .map((r) => {
          const fromCode = norm(r.from)
          const toCode = norm(r.to)

          const from = centroids[fromCode] || ORIGIN_POINTS[fromCode]
          const to = centroids[toCode] || ORIGIN_POINTS[toCode]
          if (!from || !to) return null

          return {
            type: "Feature",
            properties: {
              count: Number(r.count) || 0,
              path: r.path || "",
              from: fromCode,
              to: toCode
            },
            geometry: {
              type: "LineString",
              coordinates: [from, to]
            }
          }
        })
        .filter(Boolean)

      map.current.addSource("routes", {
        type: "geojson",
        data: { type: "FeatureCollection", features: routeFeatures }
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
