import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

const countryCenters = {
  SY: [38.9968, 34.8021],
  TR: [35.2433, 38.9637],
  LY: [17.2283, 26.3351],
  MA: [-7.0926, 31.7917],
  AF: [67.7099, 33.9391],
  GR: [21.8243, 39.0742],
  IT: [12.5674, 41.8719],
  ES: [-3.7492, 40.4637],
  DE: [10.4515, 51.1657]
}

export default function Map() {
  const mapContainer = useRef(null)
  const map = useRef(null)

  useEffect(() => {
    if (map.current) return

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://demotiles.maplibre.org/style.json',
      center: [10, 40],
      zoom: 3
    })

    map.current.on('load', async () => {
      const routes = await fetch('./data/routes_2025.json').then(r => r.json())

      const features = routes.routes.map(r => ({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            countryCenters[r.from],
            countryCenters[r.to]
          ]
        },
        properties: {
          count: r.count,
          path: r.path
        }
      }))

      map.current.addSource('routes', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features
        }
      })

      map.current.addLayer({
        id: 'routes-layer',
        type: 'line',
        source: 'routes',
        paint: {
          'line-color': [
            'match',
            ['get', 'path'],
            'Eastern Mediterranean', '#ff3333',
            'Central Mediterranean', '#ff9933',
            'Western Mediterranean', '#ffff33',
            'Balkan Route', '#33ffff',
            '#ffffff'
          ],
          'line-width': [
            'interpolate',
            ['linear'],
            ['get', 'count'],
            0, 1,
            100000, 8
          ],
          'line-opacity': 0.85
        }
      })
    })
  }, [])

  return <div ref={mapContainer} style={{ width: '100vw', height: '100vh' }} />
}
