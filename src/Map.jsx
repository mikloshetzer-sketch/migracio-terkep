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
      center: [15, 48],
      zoom: 4
    })

    map.current.on('load', async () => {
      // --- EU országok ---
      const euRes = await fetch('./data/eu_countries.geojson')
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
          'fill-color': '#4CAF50',
          'fill-opacity': 0.25
        }
      })

      map.current.addLayer({
        id: 'eu-border',
        type: 'line',
        source: 'eu',
        paint: {
          'line-color': '#2E7D32',
          'line-width': 1.5
        }
      })

      // --- Migrációs útvonalak ---
      const routeRes = await fetch('./data/routes_2025.json')
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
          'line-color': [
            'match',
            ['get', 'route'],
            'Eastern Med', '#FF0000',
            'Central Med', '#FF9800',
            'Western Med', '#FBC02D',
            'Balkan', '#2196F3',
            '#888888'
          ],
          'line-width': 4
        }
      })
    })
  }, [])

  return (
    <div
      ref={mapContainer}
      style={{ width: '100vw', height: '100vh' }}
    />
  )
}
