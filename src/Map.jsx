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
      // ✅ világos, nem kék alapstílus
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: [14, 48],
      zoom: 3.2
    })

    map.current.addControl(new maplibregl.NavigationControl(), "top-right")

    const popup = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: true
    })

    const params = new URLSearchParams(window.location.search)
    const view = params.get("v") || "choropleth" // "choropleth" | "routes"

    // Route pontok (finomhangolható később)
    const POINTS = {
      GR: [23.7275, 37.9838],
      IT: [12.4964, 41.9028],
      ES: [-3.7038, 40.4168],
      DE: [13.405, 52.52],

      SY: [36.2765, 33.5138],
      TR: [29.0, 41.0],
      LY: [13.1913, 32.8872],
      AF: [66.0, 34.5],
      // ✅ Marokkó északra, hogy “átérjen” Spanyolország felé
      MA: [-5.8, 35.7]
    }

    map.current.on("load", async () => {
      // --- 1) Countries geojson ---
      const countriesRes = await fetch("./data/eu_countries.geojson")
      const countriesGeo = await countriesRes.json()

      // --- 2) Arrivals ---
      const arrivalsRes = await fetch("./data/arrivals_2025.json")
      const arrivals = await arrivalsRes.json()
      const totals = arrivals?.totalsByCountry || {}

      // value hozzácsatolása ISO2 alapján (CNTR_ID)
      const enrichedCountries = {
        ...countriesGeo,
        features: (countriesGeo.features || []).map((f) => {
          const iso2 = f?.properties?.CNTR_ID
          const val = typeof totals?.[iso2] === "number" ? totals[iso2] : 0
          return {
            ...f,
            properties: {
              ...(f.properties || {}),
              value: val
            }
          }
        })
      }

      if (!map.current.getSource("countries")) {
        map.current.addSource("countries", {
          type: "geojson",
          data: enrichedCountries
        })
      }

      // --- Choropleth fill ---
      if (!map.current.getLayer("countries-fill")) {
        map.current.addLayer({
          id: "countries-fill",
          type: "fill",
          source: "countries",
          paint: {
            "fill-color": [
              "step",
              ["get", "value"],
              "#f2f2f2",
              1,
              "#d9f0ff",
              1000,
              "#a7d7ff",
              5000,
              "#5fb3ff",
              20000,
              "#1f7aff"
            ],
            "fill-opacity": 0.7
          }
        })
      }

      if (!map.current.getLayer("countries-outline")) {
        map.current.addLayer({
          id: "countries-outline",
          type: "line",
          source: "countries",
          paint: {
            // ✅ ne legyen “kék kontúr”
            "line-color": "#ffffff",
            "line-width": 1
          }
        })
      }

      // Tooltip csak a choropleth nézetben (különben zavaró)
      map.current.on("mousemove", "countries-fill", (e) => {
        const params2 = new URLSearchParams(window.location.search)
        const currentView = params2.get("v") || "choropleth"
        if (currentView === "routes") return

        map.current.getCanvas().style.cursor = "pointer"
        const feat = e.features?.[0]
        if (!feat) return

        const name =
          feat.properties?.NAME_ENGL ||
          feat.properties?.CNTR_NAME ||
          feat.properties?.NAME_GERM ||
          feat.properties?.CNTR_ID ||
          "Unknown"

        const value = feat.properties?.value ?? 0

        popup
          .setLngLat(e.lngLat)
          .setHTML(`<strong>${name}</strong><br/>Value: ${value}`)
          .addTo(map.current)
      })

      map.current.on("mouseleave", "countries-fill", () => {
        map.current.getCanvas().style.cursor = ""
        popup.remove()
      })

      // --- 3) Routes ---
      const routesRes = await fetch("./data/routes_2025.json")
      const routesJson = await routesRes.json()
      const routes = routesJson?.routes || []

      const routesGeo = {
        type: "FeatureCollection",
        features: routes
          .map((r, idx) => {
            const fromPt = POINTS[r.from]
            const toPt = POINTS[r.to]
            if (!fromPt || !toPt) return null
            return {
              type: "Feature",
              id: idx,
              properties: {
                from: r.from,
                to: r.to,
                count: r.count ?? 0,
                path: r.path ?? ""
              },
              geometry: {
                type: "LineString",
                coordinates: [fromPt, toPt]
              }
            }
          })
          .filter(Boolean)
      }

      if (!map.current.getSource("routes")) {
        map.current.addSource("routes", {
          type: "geojson",
          data: routesGeo
        })
      }

      if (!map.current.getLayer("routes-line")) {
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
              0,
              2,
              5000,
              4,
              20000,
              7,
              80000,
              10
            ],
            "line-opacity": 0.85
          }
        })
      }

      // --- Arrow icon ---
      const ensureArrows = () => {
        if (map.current.getLayer("routes-arrows")) return
        map.current.addLayer({
          id: "routes-arrows",
          type: "symbol",
          source: "routes",
          layout: {
            "symbol-placement": "line",
            "symbol-spacing": 90,
            "icon-image": "arrow",
            "icon-size": 0.65,
            "icon-rotation-alignment": "map",
            "icon-allow-overlap": true
          },
          paint: {
            "icon-color": "#ff3b3b",
            "icon-opacity": 0.95
          }
        })
      }

      if (!map.current.hasImage("arrow")) {
        const svg = `
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">
            <polygon points="2,12 22,6 22,18" fill="black"/>
          </svg>
        `
        const img = new Image()
        img.onload = () => {
          map.current.addImage("arrow", img, { sdf: true })
          ensureArrows()
          applyView(view)
        }
        img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg)
      } else {
        ensureArrows()
        applyView(view)
      }

      // --- View toggle ---
      function applyView(v) {
        const showRoutes = v === "routes"

        const setVis = (layerId, vis) => {
          if (map.current.getLayer(layerId)) {
            map.current.setLayoutProperty(layerId, "visibility", vis ? "visible" : "none")
          }
        }

        // ✅ országok kitöltése routes nézetben is maradjon, csak halványan
        if (map.current.getLayer("countries-fill")) {
          if (showRoutes) {
            map.current.setPaintProperty("countries-fill", "fill-color", "#f3f3f3")
            map.current.setPaintProperty("countries-fill", "fill-opacity", 0.22)
          } else {
            map.current.setPaintProperty("countries-fill", "fill-color", [
              "step",
              ["get", "value"],
              "#f2f2f2",
              1,
              "#d9f0ff",
              1000,
              "#a7d7ff",
              5000,
              "#5fb3ff",
              20000,
              "#1f7aff"
            ])
            map.current.setPaintProperty("countries-fill", "fill-opacity", 0.7)
          }
        }

        setVis("countries-fill", true)
        setVis("countries-outline", true)
        setVis("routes-line", showRoutes)
        setVis("routes-arrows", showRoutes)

        if (showRoutes) {
          map.current.flyTo({ center: [10, 28], zoom: 2.3 })
        } else {
          map.current.flyTo({ center: [14, 48], zoom: 3.2 })
        }
      }
    })

    return () => {
      if (map.current) map.current.remove()
    }
  }, [])

  return <div ref={mapContainer} style={{ width: "100vw", height: "100vh" }} />
}
