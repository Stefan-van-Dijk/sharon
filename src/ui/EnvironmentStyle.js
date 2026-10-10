// Sharon monochrome basemap, adapted from OpenFreeMap Positron (OpenMapTiles schema).
// No sprites, decorative POIs, landcover fills or raster requests.
export const environmentStyle = {
  "version": 8,
  "name": "Sharon Minimal",
  "glyphs": "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  "sources": {
    "openmaptiles": {
      "type": "vector",
      "url": "https://tiles.openfreemap.org/planet"
    }
  },
  "layers": [
    {
      "id": "background",
      "type": "background",
      "paint": {
        "background-color": "#ffffff"
      }
    },
    {
      "id": "water",
      "type": "fill",
      "source": "openmaptiles",
      "source-layer": "water",
      "filter": [
        "all",
        [
          "match",
          [
            "geometry-type"
          ],
          [
            "MultiPolygon",
            "Polygon"
          ],
          true,
          false
        ],
        [
          "!=",
          [
            "get",
            "brunnel"
          ],
          "tunnel"
        ]
      ],
      "paint": {
        "fill-color": "#f0f1f2"
      }
    },
    {
      "id": "waterway",
      "type": "line",
      "source": "openmaptiles",
      "source-layer": "waterway",
      "filter": [
        "match",
        [
          "geometry-type"
        ],
        [
          "LineString",
          "MultiLineString"
        ],
        true,
        false
      ],
      "paint": {
        "line-color": "#c4c7cc",
        "line-width": 1.1
      }
    },
    {
      "id": "building",
      "type": "fill",
      "source": "openmaptiles",
      "source-layer": "building",
      "minzoom": 14,
      "paint": {
        "fill-color": "#fafafa",
        "fill-outline-color": "#dddddf"
      }
    },
    {
      "id": "tunnel_motorway_inner",
      "type": "line",
      "source": "openmaptiles",
      "source-layer": "transportation",
      "minzoom": 6,
      "filter": [
        "all",
        [
          "match",
          [
            "geometry-type"
          ],
          [
            "LineString",
            "MultiLineString"
          ],
          true,
          false
        ],
        [
          "all",
          [
            "==",
            [
              "get",
              "brunnel"
            ],
            "tunnel"
          ],
          [
            "==",
            [
              "get",
              "class"
            ],
            "motorway"
          ]
        ]
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-color": "#818187",
        "line-width": [
          "interpolate",
          [
            "linear"
          ],
          [
            "zoom"
          ],
          4,
          0.55,
          12,
          0.9,
          16,
          1.3,
          20,
          2.3
        ]
      }
    },
    {
      "id": "aeroway-taxiway",
      "type": "line",
      "source": "openmaptiles",
      "source-layer": "aeroway",
      "minzoom": 12,
      "filter": [
        "match",
        [
          "get",
          "class"
        ],
        [
          "taxiway"
        ],
        true,
        false
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-color": "#ccccd1",
        "line-width": 1
      }
    },
    {
      "id": "aeroway-runway",
      "type": "line",
      "source": "openmaptiles",
      "source-layer": "aeroway",
      "minzoom": 11,
      "filter": [
        "all",
        [
          "match",
          [
            "get",
            "class"
          ],
          [
            "runway"
          ],
          true,
          false
        ],
        [
          "match",
          [
            "geometry-type"
          ],
          [
            "LineString",
            "MultiLineString"
          ],
          true,
          false
        ]
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-color": "#ccccd1",
        "line-width": 1
      }
    },
    {
      "id": "road_pier",
      "type": "line",
      "source": "openmaptiles",
      "source-layer": "transportation",
      "filter": [
        "all",
        [
          "match",
          [
            "geometry-type"
          ],
          [
            "LineString",
            "MultiLineString"
          ],
          true,
          false
        ],
        [
          "match",
          [
            "get",
            "class"
          ],
          [
            "pier"
          ],
          true,
          false
        ]
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-color": "#bdbdc3",
        "line-width": [
          "interpolate",
          [
            "linear"
          ],
          [
            "zoom"
          ],
          4,
          0.55,
          12,
          0.9,
          16,
          1.3,
          20,
          2.3
        ]
      }
    },
    {
      "id": "highway_path",
      "type": "line",
      "source": "openmaptiles",
      "source-layer": "transportation",
      "filter": [
        "all",
        [
          "match",
          [
            "geometry-type"
          ],
          [
            "LineString",
            "MultiLineString"
          ],
          true,
          false
        ],
        [
          "==",
          [
            "get",
            "class"
          ],
          "path"
        ]
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-color": "#c9c9ce",
        "line-width": 0.9,
        "line-dasharray": [
          3,
          4
        ]
      }
    },
    {
      "id": "highway_minor",
      "type": "line",
      "source": "openmaptiles",
      "source-layer": "transportation",
      "minzoom": 8,
      "filter": [
        "all",
        [
          "match",
          [
            "geometry-type"
          ],
          [
            "LineString",
            "MultiLineString"
          ],
          true,
          false
        ],
        [
          "match",
          [
            "get",
            "class"
          ],
          [
            "minor",
            "service",
            "track"
          ],
          true,
          false
        ]
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-color": "#bdbdc3",
        "line-width": [
          "interpolate",
          [
            "linear"
          ],
          [
            "zoom"
          ],
          4,
          0.55,
          12,
          0.9,
          16,
          1.3,
          20,
          2.3
        ]
      }
    },
    {
      "id": "highway_major_inner",
      "type": "line",
      "source": "openmaptiles",
      "source-layer": "transportation",
      "minzoom": 11,
      "filter": [
        "all",
        [
          "match",
          [
            "geometry-type"
          ],
          [
            "LineString",
            "MultiLineString"
          ],
          true,
          false
        ],
        [
          "match",
          [
            "get",
            "class"
          ],
          [
            "primary",
            "secondary",
            "tertiary",
            "trunk"
          ],
          true,
          false
        ]
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-color": "#a4a4aa",
        "line-width": [
          "interpolate",
          [
            "linear"
          ],
          [
            "zoom"
          ],
          4,
          0.55,
          12,
          0.9,
          16,
          1.3,
          20,
          2.3
        ]
      }
    },
    {
      "id": "highway_major_subtle",
      "type": "line",
      "source": "openmaptiles",
      "source-layer": "transportation",
      "maxzoom": 11,
      "filter": [
        "all",
        [
          "match",
          [
            "geometry-type"
          ],
          [
            "LineString",
            "MultiLineString"
          ],
          true,
          false
        ],
        [
          "match",
          [
            "get",
            "class"
          ],
          [
            "primary",
            "secondary",
            "tertiary",
            "trunk"
          ],
          true,
          false
        ]
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-color": "#a4a4aa",
        "line-width": [
          "interpolate",
          [
            "linear"
          ],
          [
            "zoom"
          ],
          4,
          0.55,
          12,
          0.9,
          16,
          1.3,
          20,
          2.3
        ]
      }
    },
    {
      "id": "highway_motorway_inner",
      "type": "line",
      "source": "openmaptiles",
      "source-layer": "transportation",
      "minzoom": 6,
      "filter": [
        "all",
        [
          "match",
          [
            "geometry-type"
          ],
          [
            "LineString",
            "MultiLineString"
          ],
          true,
          false
        ],
        [
          "all",
          [
            "match",
            [
              "get",
              "brunnel"
            ],
            [
              "bridge",
              "tunnel"
            ],
            false,
            true
          ],
          [
            "==",
            [
              "get",
              "class"
            ],
            "motorway"
          ]
        ]
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-color": "#818187",
        "line-width": [
          "interpolate",
          [
            "linear"
          ],
          [
            "zoom"
          ],
          4,
          0.55,
          12,
          0.9,
          16,
          1.3,
          20,
          2.3
        ]
      }
    },
    {
      "id": "highway_motorway_subtle",
      "type": "line",
      "source": "openmaptiles",
      "source-layer": "transportation",
      "maxzoom": 6,
      "filter": [
        "all",
        [
          "match",
          [
            "geometry-type"
          ],
          [
            "LineString",
            "MultiLineString"
          ],
          true,
          false
        ],
        [
          "==",
          [
            "get",
            "class"
          ],
          "motorway"
        ]
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-color": "#818187",
        "line-width": [
          "interpolate",
          [
            "linear"
          ],
          [
            "zoom"
          ],
          4,
          0.55,
          12,
          0.9,
          16,
          1.3,
          20,
          2.3
        ]
      }
    },
    {
      "id": "railway_transit",
      "type": "line",
      "source": "openmaptiles",
      "source-layer": "transportation",
      "minzoom": 16,
      "filter": [
        "all",
        [
          "match",
          [
            "geometry-type"
          ],
          [
            "LineString",
            "MultiLineString"
          ],
          true,
          false
        ],
        [
          "all",
          [
            "==",
            [
              "get",
              "class"
            ],
            "transit"
          ],
          [
            "match",
            [
              "get",
              "brunnel"
            ],
            [
              "tunnel"
            ],
            false,
            true
          ]
        ]
      ],
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "#a6a6ac",
        "line-width": 1.1,
        "line-dasharray": [
          6,
          3
        ]
      }
    },
    {
      "id": "railway_service",
      "type": "line",
      "source": "openmaptiles",
      "source-layer": "transportation",
      "minzoom": 16,
      "filter": [
        "all",
        [
          "match",
          [
            "geometry-type"
          ],
          [
            "LineString",
            "MultiLineString"
          ],
          true,
          false
        ],
        [
          "all",
          [
            "==",
            [
              "get",
              "class"
            ],
            "rail"
          ],
          [
            "has",
            "service"
          ]
        ]
      ],
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "#a6a6ac",
        "line-width": 1.1,
        "line-dasharray": [
          6,
          3
        ]
      }
    },
    {
      "id": "railway",
      "type": "line",
      "source": "openmaptiles",
      "source-layer": "transportation",
      "minzoom": 13,
      "filter": [
        "all",
        [
          "match",
          [
            "geometry-type"
          ],
          [
            "LineString",
            "MultiLineString"
          ],
          true,
          false
        ],
        [
          "all",
          [
            "!",
            [
              "has",
              "service"
            ]
          ],
          [
            "==",
            [
              "get",
              "class"
            ],
            "rail"
          ]
        ]
      ],
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "#a6a6ac",
        "line-width": 1.1,
        "line-dasharray": [
          6,
          3
        ]
      }
    },
    {
      "id": "highway_motorway_bridge_inner",
      "type": "line",
      "source": "openmaptiles",
      "source-layer": "transportation",
      "minzoom": 6,
      "filter": [
        "all",
        [
          "match",
          [
            "geometry-type"
          ],
          [
            "LineString",
            "MultiLineString"
          ],
          true,
          false
        ],
        [
          "all",
          [
            "==",
            [
              "get",
              "brunnel"
            ],
            "bridge"
          ],
          [
            "==",
            [
              "get",
              "class"
            ],
            "motorway"
          ]
        ]
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-color": "#818187",
        "line-width": [
          "interpolate",
          [
            "linear"
          ],
          [
            "zoom"
          ],
          4,
          0.55,
          12,
          0.9,
          16,
          1.3,
          20,
          2.3
        ]
      }
    },
    {
      "id": "boundary_3",
      "type": "line",
      "source": "openmaptiles",
      "source-layer": "boundary",
      "minzoom": 8,
      "filter": [
        "all",
        [
          ">=",
          [
            "get",
            "admin_level"
          ],
          3
        ],
        [
          "<=",
          [
            "get",
            "admin_level"
          ],
          6
        ],
        [
          "!=",
          [
            "get",
            "maritime"
          ],
          1
        ],
        [
          "!=",
          [
            "get",
            "disputed"
          ],
          1
        ],
        [
          "!",
          [
            "has",
            "claimed_by"
          ]
        ]
      ],
      "paint": {
        "line-color": "#d1d1d6",
        "line-width": 0.8,
        "line-dasharray": [
          5,
          4
        ]
      }
    },
    {
      "id": "boundary_2",
      "type": "line",
      "source": "openmaptiles",
      "source-layer": "boundary",
      "filter": [
        "all",
        [
          "==",
          [
            "get",
            "admin_level"
          ],
          2
        ],
        [
          "!=",
          [
            "get",
            "maritime"
          ],
          1
        ],
        [
          "!=",
          [
            "get",
            "disputed"
          ],
          1
        ],
        [
          "!",
          [
            "has",
            "claimed_by"
          ]
        ]
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-color": "#d1d1d6",
        "line-width": 0.8,
        "line-dasharray": [
          5,
          4
        ]
      }
    },
    {
      "id": "boundary_disputed",
      "type": "line",
      "source": "openmaptiles",
      "source-layer": "boundary",
      "filter": [
        "all",
        [
          "!=",
          [
            "get",
            "maritime"
          ],
          1
        ],
        [
          "==",
          [
            "get",
            "disputed"
          ],
          1
        ]
      ],
      "paint": {
        "line-color": "#d1d1d6",
        "line-width": 0.8,
        "line-dasharray": [
          5,
          4
        ]
      }
    },
    {
      "id": "highway-name-minor",
      "type": "symbol",
      "source": "openmaptiles",
      "source-layer": "transportation_name",
      "minzoom": 15,
      "filter": [
        "all",
        [
          "match",
          [
            "geometry-type"
          ],
          [
            "LineString",
            "MultiLineString"
          ],
          true,
          false
        ],
        [
          "match",
          [
            "get",
            "class"
          ],
          [
            "minor",
            "service",
            "track"
          ],
          true,
          false
        ]
      ],
      "layout": {
        "symbol-placement": "line",
        "text-field": [
          "coalesce",
          [
            "get",
            "name:nl"
          ],
          [
            "get",
            "name"
          ],
          [
            "get",
            "name:latin"
          ],
          [
            "get",
            "name_en"
          ]
        ],
        "text-font": [
          "Noto Sans Regular"
        ],
        "text-rotation-alignment": "map",
        "text-size": 11,
        "symbol-spacing": 350,
        "text-padding": 8
      },
      "paint": {
        "text-color": "#77777e",
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.6
      }
    },
    {
      "id": "highway-name-major",
      "type": "symbol",
      "source": "openmaptiles",
      "source-layer": "transportation_name",
      "minzoom": 14,
      "filter": [
        "match",
        [
          "get",
          "class"
        ],
        [
          "primary",
          "secondary",
          "tertiary",
          "trunk"
        ],
        true,
        false
      ],
      "layout": {
        "symbol-placement": "line",
        "text-field": [
          "coalesce",
          [
            "get",
            "name:nl"
          ],
          [
            "get",
            "name"
          ],
          [
            "get",
            "name:latin"
          ],
          [
            "get",
            "name_en"
          ]
        ],
        "text-font": [
          "Noto Sans Regular"
        ],
        "text-rotation-alignment": "map",
        "text-size": 11,
        "symbol-spacing": 350,
        "text-padding": 8
      },
      "paint": {
        "text-color": "#77777e",
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.6
      }
    },
    {
      "id": "label_other",
      "type": "symbol",
      "source": "openmaptiles",
      "source-layer": "place",
      "minzoom": 8,
      "filter": [
        "match",
        [
          "get",
          "class"
        ],
        [
          "city",
          "continent",
          "country",
          "state",
          "town",
          "village"
        ],
        false,
        true
      ],
      "layout": {
        "text-field": [
          "coalesce",
          [
            "get",
            "name:nl"
          ],
          [
            "get",
            "name"
          ],
          [
            "get",
            "name:latin"
          ],
          [
            "get",
            "name_en"
          ]
        ],
        "text-font": [
          "Noto Sans Regular"
        ],
        "text-letter-spacing": 0.1,
        "text-max-width": 9,
        "text-size": [
          "interpolate",
          [
            "linear"
          ],
          [
            "zoom"
          ],
          8,
          9,
          12,
          10
        ],
        "text-transform": "uppercase",
        "text-padding": 8
      },
      "paint": {
        "text-color": "#77777e",
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.6
      }
    },
    {
      "id": "label_village",
      "type": "symbol",
      "source": "openmaptiles",
      "source-layer": "place",
      "minzoom": 9,
      "filter": [
        "==",
        [
          "get",
          "class"
        ],
        "village"
      ],
      "layout": {
        "text-anchor": "bottom",
        "text-field": [
          "coalesce",
          [
            "get",
            "name:nl"
          ],
          [
            "get",
            "name"
          ],
          [
            "get",
            "name:latin"
          ],
          [
            "get",
            "name_en"
          ]
        ],
        "text-font": [
          "Noto Sans Regular"
        ],
        "text-max-width": 8,
        "text-size": [
          "interpolate",
          [
            "exponential",
            1.2
          ],
          [
            "zoom"
          ],
          7,
          10,
          11,
          12
        ],
        "text-padding": 8
      },
      "paint": {
        "text-color": "#77777e",
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.6
      }
    },
    {
      "id": "label_town",
      "type": "symbol",
      "source": "openmaptiles",
      "source-layer": "place",
      "minzoom": 6,
      "filter": [
        "==",
        [
          "get",
          "class"
        ],
        "town"
      ],
      "layout": {
        "text-anchor": "bottom",
        "text-field": [
          "coalesce",
          [
            "get",
            "name:nl"
          ],
          [
            "get",
            "name"
          ],
          [
            "get",
            "name:latin"
          ],
          [
            "get",
            "name_en"
          ]
        ],
        "text-font": [
          "Noto Sans Regular"
        ],
        "text-max-width": 8,
        "text-size": [
          "interpolate",
          [
            "exponential",
            1.2
          ],
          [
            "zoom"
          ],
          7,
          12,
          11,
          14
        ],
        "text-padding": 8
      },
      "paint": {
        "text-color": "#77777e",
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.6
      }
    },
    {
      "id": "label_state",
      "type": "symbol",
      "source": "openmaptiles",
      "source-layer": "place",
      "minzoom": 5,
      "maxzoom": 8,
      "filter": [
        "==",
        [
          "get",
          "class"
        ],
        "state"
      ],
      "layout": {
        "text-field": [
          "coalesce",
          [
            "get",
            "name:nl"
          ],
          [
            "get",
            "name"
          ],
          [
            "get",
            "name:latin"
          ],
          [
            "get",
            "name_en"
          ]
        ],
        "text-font": [
          "Noto Sans Regular"
        ],
        "text-letter-spacing": 0.2,
        "text-max-width": 9,
        "text-size": [
          "interpolate",
          [
            "linear"
          ],
          [
            "zoom"
          ],
          5,
          10,
          8,
          14
        ],
        "text-transform": "uppercase",
        "text-padding": 8
      },
      "paint": {
        "text-color": "#77777e",
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.6
      }
    },
    {
      "id": "label_city",
      "type": "symbol",
      "source": "openmaptiles",
      "source-layer": "place",
      "minzoom": 3,
      "filter": [
        "all",
        [
          "==",
          [
            "get",
            "class"
          ],
          "city"
        ],
        [
          "!=",
          [
            "get",
            "capital"
          ],
          2
        ]
      ],
      "layout": {
        "text-anchor": "bottom",
        "text-field": [
          "coalesce",
          [
            "get",
            "name:nl"
          ],
          [
            "get",
            "name"
          ],
          [
            "get",
            "name:latin"
          ],
          [
            "get",
            "name_en"
          ]
        ],
        "text-font": [
          "Noto Sans Regular"
        ],
        "text-max-width": 8,
        "text-offset": [
          0,
          -0.1
        ],
        "text-size": [
          "interpolate",
          [
            "exponential",
            1.2
          ],
          [
            "zoom"
          ],
          4,
          11,
          7,
          13,
          11,
          18
        ],
        "text-padding": 8
      },
      "paint": {
        "text-color": "#77777e",
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.6
      }
    },
    {
      "id": "label_city_capital",
      "type": "symbol",
      "source": "openmaptiles",
      "source-layer": "place",
      "minzoom": 3,
      "filter": [
        "all",
        [
          "==",
          [
            "get",
            "class"
          ],
          "city"
        ],
        [
          "==",
          [
            "get",
            "capital"
          ],
          2
        ]
      ],
      "layout": {
        "text-anchor": "bottom",
        "text-field": [
          "coalesce",
          [
            "get",
            "name:nl"
          ],
          [
            "get",
            "name"
          ],
          [
            "get",
            "name:latin"
          ],
          [
            "get",
            "name_en"
          ]
        ],
        "text-font": [
          "Noto Sans Regular"
        ],
        "text-max-width": 8,
        "text-offset": [
          0,
          -0.2
        ],
        "text-size": [
          "interpolate",
          [
            "exponential",
            1.2
          ],
          [
            "zoom"
          ],
          4,
          12,
          7,
          14,
          11,
          20
        ],
        "text-padding": 8
      },
      "paint": {
        "text-color": "#77777e",
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.6
      }
    },
    {
      "id": "label_country_3",
      "type": "symbol",
      "source": "openmaptiles",
      "source-layer": "place",
      "minzoom": 2,
      "maxzoom": 9,
      "filter": [
        "all",
        [
          "==",
          [
            "get",
            "class"
          ],
          "country"
        ],
        [
          ">=",
          [
            "get",
            "rank"
          ],
          3
        ]
      ],
      "layout": {
        "text-field": [
          "coalesce",
          [
            "get",
            "name:nl"
          ],
          [
            "get",
            "name"
          ],
          [
            "get",
            "name:latin"
          ],
          [
            "get",
            "name_en"
          ]
        ],
        "text-font": [
          "Noto Sans Regular"
        ],
        "text-max-width": 6.25,
        "text-size": [
          "interpolate",
          [
            "linear"
          ],
          [
            "zoom"
          ],
          3,
          9,
          7,
          17
        ],
        "text-padding": 8
      },
      "paint": {
        "text-color": "#77777e",
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.6
      }
    },
    {
      "id": "label_country_2",
      "type": "symbol",
      "source": "openmaptiles",
      "source-layer": "place",
      "maxzoom": 9,
      "filter": [
        "all",
        [
          "==",
          [
            "get",
            "class"
          ],
          "country"
        ],
        [
          "==",
          [
            "get",
            "rank"
          ],
          2
        ]
      ],
      "layout": {
        "text-field": [
          "coalesce",
          [
            "get",
            "name:nl"
          ],
          [
            "get",
            "name"
          ],
          [
            "get",
            "name:latin"
          ],
          [
            "get",
            "name_en"
          ]
        ],
        "text-font": [
          "Noto Sans Regular"
        ],
        "text-max-width": 6.25,
        "text-size": [
          "interpolate",
          [
            "linear"
          ],
          [
            "zoom"
          ],
          2,
          9,
          5,
          17
        ],
        "text-padding": 8
      },
      "paint": {
        "text-color": "#77777e",
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.6
      }
    },
    {
      "id": "label_country_1",
      "type": "symbol",
      "source": "openmaptiles",
      "source-layer": "place",
      "maxzoom": 9,
      "filter": [
        "all",
        [
          "==",
          [
            "get",
            "class"
          ],
          "country"
        ],
        [
          "==",
          [
            "get",
            "rank"
          ],
          1
        ]
      ],
      "layout": {
        "text-field": [
          "coalesce",
          [
            "get",
            "name:nl"
          ],
          [
            "get",
            "name"
          ],
          [
            "get",
            "name:latin"
          ],
          [
            "get",
            "name_en"
          ]
        ],
        "text-font": [
          "Noto Sans Regular"
        ],
        "text-max-width": 6.25,
        "text-size": [
          "interpolate",
          [
            "linear"
          ],
          [
            "zoom"
          ],
          1,
          9,
          4,
          17
        ],
        "text-padding": 8
      },
      "paint": {
        "text-color": "#77777e",
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.6
      }
    }
  ]
};
