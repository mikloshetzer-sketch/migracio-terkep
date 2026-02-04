import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

export default function Map() {
  const mapContainer = useRef(null)
  const map = useRef(null)

  useEffect(() => {
    if (map.current) return

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://demotiles.maplibre.org/style.json',
      center: [10, 50],
      zoom: 4
    })

    map.current.on('load', async () => {
      try {
        // FIXED absolute paths for GitHub Pages
        const base = '/migracio-terkep/data/'

        // --- Load EU countries GeoJSON
        const euRes = await fetch(base + 'eu_countries.geojson')
        const euData = await euRes.json()

        map.current.addSource('eu', {
          type: 'geojson',
          data: euData
        })

        map.current.addLayer({
          id: 'eu-fill',
          type: 'fill',
          source: 'eu',
          paint: {
            'fill-color': '#5aa9e6',
            'fill-opacity': 0.4
          }
        })

        map.current.addLayer({
          id: 'eu-borders',
          type: 'line',
          source: 'eu',
          paint: {
            'line-color': '#1d3557',
            'line-width': 1
          }
        })

        // --- Load migration routes
        const routesRes = await fetch(base + 'routes_2025.json')
        const routesData = await routesRes.json()

        // Convert routes into GeoJSON LineStrings
        const features = routesData.routes.map((r) => ({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              countryCentroid(r.from),
              countryCentroid(r.to)
            ]
          },
          properties: {
            count: r.count,
            path: r.path
          }
        }))

        const geojsonRoutes = {
          type: 'FeatureCollection',
          features
        }

        map.current.addSource('routes', {
          type: 'geojson',
          data: geojsonRoutes
        })

        map.current.addLayer({
          id: 'routes-line',
          type: 'line',
          source: 'routes',
          paint: {
            'line-color': '#e63946',
            'line-width': [
              'interpolate',
              ['linear'],
              ['get', 'count'],
              1000,
              1,
              100000,
              6
            ],
            'line-opacity': 0.8
          }
        })
      } catch (err) {
        console.error('Hiba adatbetöltésnél:', err)
      }
    })
  }, [])

  return <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
}

// Very simple centroids for demo purposes
function countryCentroid(code) {
  const centroids = {
    SY: [38.9968, 34.8021],
    TR: [35.2433, 38.9637],
    GR: [21.8243, 39.0742],
    IT: [12.5674, 41.8719],
    DE: [10.4515, 51.1657],
    FR: [2.2137, 46.2276],
    HU: [19.5033, 47.1625],
    AT: [14.5501, 47.5162],
    ES: [-3.7492, 40.4637],
    PL: [19.]()
