// Sharon monochrome basemap, adapted from OpenFreeMap Positron (OpenMapTiles schema).
// No labels, sprites, glyphs, decorative POIs, landcover fills or raster requests.
export const environmentStyle = {
  "version": 8,
  "name": "Sharon Minimal",
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
        "fill-color": "#f6f8fa",
        "fill-outline-color": "#dce3e8"
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
        "fill-color": "#fcfcfd",
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
    }
  ]
};
