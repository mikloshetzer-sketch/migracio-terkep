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

    map.current.on('load', async () => {
      // 1) GeoJSON betöltés
      const geoRes = await fetch('./data/eu_countries.geojson')
      const geojson = await geoRes.json()

      // 2) (placeholder) érkezők betöltés
      const dataRes = await fetch('./data/arrivals_2025.json')
      const stats = await dataRes.json()

      // gyors lookup: országkód -> érték
      const totals = stats?.totalsByCountry || {}

      // Feature-ökbe beírjuk a value-t (CNTR_ID: kétbetűs kód pl. DE, FR, HU)
      for (const f of geojson.features) {
        const code = f?.properties?.CNTR_ID
        f.properties.value = totals[code] ?? 0
      }

      // Source
      map.current.addSource('eu-countries', {
        type: 'geojson',
        data: geojson
      })

      // Fill réteg (színezés – most minden 0, később adatokkal látszik)
      map.current.addLayer({
        id: 'eu-fill',
        type: 'fill',
        source: 'eu-countries',
        paint: {
          'fill-color': [
            'interpolate',
            ['linear'],
            ['get', 'value'],
            0, '#fff7bc',
            1000, '#fee391',
            5000, '#fec44f',
            20000, '#fe9929',
            50000, '#ec7014',
            100000, '#cc4c02',
            200000, '#8c2d04'
          ],
          'fill-opacity': 0.6
        }
      })

      // Körvonal
      map.current.addLayer({
        id: 'eu-line',
        type: 'line',
        source: 'eu-countries',
        paint: {
          'line-color': '#444',
          'line-width': 0.8
        }
      })

      // Hover popup
      const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false })

      map.current.on('mousemove', 'eu-fill', (e) => {
        map.current.getCanvas().style.cursor = 'pointer'
        const f = e.features?.[0]
        if (!f) return
        const name = f.properties?.NAME_ENGL || f.properties?.CNTR_NAME || 'Unknown'
        const value = Number(f.properties?.value || 0).toLocaleString('hu-HU')
        popup
          .setLngLat(e.lngLat)
          .setHTML(`<b>${name}</b><br/>2025: ${value} fő`)
          .addTo(map.current)
      })

      map.current.on('mouseleave', 'eu-fill', () => {
        map.current.getCanvas().style.cursor = ''
        popup.remove()
      })
    })
  }, [])

  return <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
}
