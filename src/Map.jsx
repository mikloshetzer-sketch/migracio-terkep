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
      zoom: 3
    })

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right')
  }, [])

  return (
    <div
      ref={mapContainer}
      style={{ width: '100%', height: '100%' }}
    />
  )
}
