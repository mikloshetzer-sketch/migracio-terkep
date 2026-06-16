import React, { useEffect, useRef } from "react";

import maplibregl from "maplibre-gl";

import "maplibre-gl/dist/maplibre-gl.css";

function GlobalMap() {

  const mapContainer = useRef(null);

  const mapRef = useRef(null);

  useEffect(() => {

    if (mapRef.current) return;

    const map = new maplibregl.Map({

      container: mapContainer.current,

      style: "https://demotiles.maplibre.org/style.json",

      center: [18,39],

      zoom:3.2

    });

    mapRef.current = map;

    map.addControl(
      new maplibregl.NavigationControl(),
      "top-right"
    );

    map.on("load", async () => {

      const corridorResponse = await fetch(
        `${import.meta.env.BASE_URL}data/corridors.geojson`
      );

      const hotspotResponse = await fetch(
        `${import.meta.env.BASE_URL}data/hotspots.geojson`
      );

      const corridors = await corridorResponse.json();

      const hotspots = await hotspotResponse.json();

      map.addSource("corridors",{

        type:"geojson",

        data:corridors

      });

      map.addSource("hotspots",{

        type:"geojson",

        data:hotspots

      });

      map.addLayer({

        id:"corridor-glow",

        type:"line",

        source:"corridors",

        paint:{

          "line-color":"#58d6ff",

          "line-width":[

            "interpolate",

            ["linear"],

            ["get","pressure"],

            40,8,

            90,18

          ],

          "line-opacity":0.18

        }

      });

      map.addLayer({

        id:"corridor-line",

        type:"line",

        source:"corridors",

        paint:{

          "line-color":"#58d6ff",

          "line-width":[

            "interpolate",

            ["linear"],

            ["get","pressure"],

            40,3,

            90,8

          ],

          "line-opacity":0.9

        }

      });

      map.addLayer({

        id:"hotspots-circle",

        type:"circle",

        source:"hotspots",

        paint:{

          "circle-radius":[

            "interpolate",

            ["linear"],

            ["get","pressure"],

            40,8,

            90,18

          ],

          "circle-color":"#ef4444",

          "circle-opacity":0.8,

          "circle-stroke-width":1,

          "circle-stroke-color":"#ffffff"

        }

      });

      map.on(

        "click",

        "hotspots-circle",

        (event)=>{

          const feature = event.features[0];

          new maplibregl.Popup()

          .setLngLat(

            feature.geometry.coordinates

          )

          .setHTML(`

            <strong>

              ${feature.properties.name}

            </strong>

            <br>

            Pressure:

            ${feature.properties.pressure}

          `)

          .addTo(map);

        }

      );

    });

  },[]);

  return (

    <div

      className="global-map"

      ref={mapContainer}

    />

  );

}

export default GlobalMap;
