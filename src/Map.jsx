import { useEffect, useRef } from "react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"

export default function Map() {
  const mapContainer = useRef(null)
  const mapRef = useRef(null)

  useEffect(() => {
    if (mapRef.current) return

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://demotiles.maplibre.org/style.json",
      center: [19.2, 47.2], // Budapest környéke
      zoom: 3.8,
    })
    mapRef.current = map

    map.addControl(new maplibregl.NavigationControl(), "top-right")

    // GitHub Pages + Vite: a public/ alatti fájlokat így érdemes kérni
    const base = import.meta.env.BASE_URL || "/"

    async function loadAll() {
      // 1) országok geojson
      const countriesRes = await fetch(`${base}data/eu_countries.geojson`)
      if (!countriesRes.ok) throw new Error("Nem tölthető: public/data/eu_countries.geojson")
      const countries = await countriesRes.json()

      // 2) érkezések
      const arrivalsRes = await fetch(`${base}data/arrivals_2025.json`)
      if (!arrivalsRes.ok) throw new Error("Nem tölthető: public/data/arrivals_2025.json")
      const arrivals = await arrivalsRes.json()

      // 3) útvonalak
      const routesRes = await fetch(`${base}data/routes_2025.json`)
      if (!routesRes.ok) throw new Error("Nem tölthető: public/data/routes_2025.json")
      const routes = await routesRes.json()

      const totals = arrivals?.totalsByCountry || {}

      // Choropleth: egyszerű küszöbök (a saját adataidhoz később finomítjuk)
      const getColor = (v) => {
        if (v >= 200000) return "#084081"
        if (v >= 100000) return "#0868ac"
        if (v >= 50000) return "#2b8cbe"
        if (v >= 20000) return "#4eb3d3"
        if (v >= 10000) return "#7bccc4"
        if (v >= 1000) return "#a8ddb5"
        if (v > 0) return "#ccebc5"
        return "#f7f7f7"
      }

      // GeoJSON feature-ökbe beírjuk az értéket és a színt
      const enriched = {
        ...countries,
        features: (countries.features || []).map((f) => {
          const props = f.properties || {}
          // CNTR_ID (EU GISCO) sokszor 2 betűs (pl. "HU"), ezt használjuk
          const id =
            props.CNTR_ID ||
            props.ISO2 ||
            props.iso2 ||
            props.ISO_A2 ||
            props.ISO2_CODE ||
            props.ISO_CODE

          const value = Number(totals?.[id] ?? 0)
          return {
            ...f,
            properties: {
              ...props,
              value,
              fill: getColor(value),
              iso2: id,
            },
          }
        }),
      }

      if (!map.getSource("countries")) {
        map.addSource("countries", { type: "geojson", data: enriched })
      } else {
        map.getSource("countries").setData(enriched)
      }

      if (!map.getLayer("countries-fill")) {
        map.addLayer({
          id: "countries-fill",
          type: "fill",
          source: "countries",
          paint: {
            "fill-color": ["get", "fill"],
            "fill-opacity": 0.75,
          },
        })
      }

      if (!map.getLayer("countries-outline")) {
        map.addLayer({
          id: "countries-outline",
          type: "line",
          source: "countries",
          paint: {
            "line-color": "#ffffff",
            "line-width": 1,
          },
        })
      }

      // Hover popup
      const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false })

      map.on("mousemove", "countries-fill", (e) => {
        map.getCanvas().style.cursor = "pointer"
        const f = e.features?.[0]
        if (!f) return
        const name =
          f.properties?.CNTR_NAME ||
          f.properties?.NAME_ENGL ||
          f.properties?.NAME ||
          f.properties?.name ||
          f.properties?.iso2 ||
          "Country"
        const value = f.properties?.value ?? 0

        popup
          .setLngLat(e.lngLat)
          .setHTML(`<b>${name}</b><br/>Arrivals: ${Number(value).toLocaleString("hu-HU")}`)
          .addTo(map)
      })

      map.on("mouseleave", "countries-fill", () => {
        map.getCanvas().style.cursor = ""
        popup.remove()
      })

      // ROUTES: egyszerű vonalak (ha van coords/geometry, azt használja; különben csak placeholder)
      // Itt a te routes_2025.json-ed alapján: { routes: [{from,to,count,path}] }
      // Mivel nincs benne koordináta, most csak a logika/struktúra van meg.
      // Következő lépés: adunk "fromLngLat" és "toLngLat" mezőket, vagy készítünk lookup-ot.
      const routeList = routes?.routes || []

      // egyelőre nem rajzolunk, ha nincs geometria (nehogy hibázzon)
      // később ezt továbbfejlesztjük.
      // Ha később beteszünk geometry-t, ez a rész működni fog:
      const routeFeatures = routeList
        .map((r) => {
          // támogatunk két formát:
          // 1) r.geometry (GeoJSON LineString)
          // 2) r.coords = [[lng,lat],[lng,lat],...]
          if (r?.geometry?.type === "LineString") {
            return {
              type: "Feature",
              properties: { count: r.count || 0, name: r.path || "" },
              geometry: r.geometry,
            }
          }
          if (Array.isArray(r?.coords) && r.coords.length >= 2) {
            return {
              type: "Feature",
              properties: { count: r.count || 0, name: r.path || "" },
              geometry: { type: "LineString", coordinates: r.coords },
            }
          }
          return null
        })
        .filter(Boolean)

      const routesGeojson = { type: "FeatureCollection", features: routeFeatures }

      if (!map.getSource("routes")) {
        map.addSource("routes", { type: "geojson", data: routesGeojson })
      } else {
        map.getSource("routes").setData(routesGeojson)
      }

      if (!map.getLayer("routes-line")) {
        map.addLayer({
          id: "routes-line",
          type: "line",
          source: "routes",
          paint: {
            "line-color": "#ff0066",
            "line-width": [
              "interpolate",
              ["linear"],
              ["get", "count"],
              0,
              1,
              50000,
              3,
              200000,
              6,
            ],
            "line-opacity": 0.85,
          },
        })
      }
    }

    map.on("load", () => {
      loadAll().catch((err) => {
        console.error(err)
        // ha baj van, legalább látszódjon a konzolban
        alert(`Hiba adatbetöltésnél: ${err.message}`)
      })
    })

    return () => {
      map.remove()
    }
  }, [])

  return <div ref={mapContainer} style={{ width: "100vw", height: "100vh" }} />
}
