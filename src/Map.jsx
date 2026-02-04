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
        // GITHUB PAGES BASE PATH FIX
        const base = import.meta.env.BASE_URL

        // LOAD EU COUNTRIES
        const euRes = await fetch(`${base}data/eu_countries.geojson`)
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
            'fill-color': '#4caf50',
            'fill-opacity': 0.4
          }
        })

        map.current.addLayer({
          id: 'eu-border',
          type: 'line',
          source: 'eu',
          paint: {
            'line-color': '#2e7d32',
            'line-width': 2
          }
        })

        // LOAD MIGRATION ROUTES
        const routeRes = await fetch(`${base}data/routes_2025.json`)
        const routeData = await routeRes.json()

        map.current.addSource('routes', {
          type: 'geojson',
          data: routeData
        })

        map.current.addLayer({
          id: 'routes-line',
          type: 'line',
          source: 'routes',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#ff0000',
            'line-width': 3
          }
        })
      } catch (err) {
        console.error('Map data load error:', err)
      }
    })
  }, [])

  return (
    <div
      ref={mapContainer}
      style={{ width: '100vw', height: '100vh' }}
    />
  )
}
