// Sharon monochrome basemap, adapted from OpenFreeMap Positron (OpenMapTiles schema).
// No labels, sprites, glyphs, decorative POIs or raster requests; subtle,
// non-overlapping OpenMapTiles landcover classes keep every terrain color editable.
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
      "id": "forest",
      "type": "fill",
      "source": "openmaptiles",
      "source-layer": "landcover",
      "minzoom": 5,
      "filter": ["==", ["get", "class"], "wood"],
      "paint": { "fill-color": "#edf4ee", "fill-opacity": 1 }
    },
    {
      "id": "green",
      "type": "fill",
      "source": "openmaptiles",
      "source-layer": "landcover",
      "minzoom": 7,
      "filter": ["in", ["get", "subclass"], ["literal", ["park", "garden", "flowerbed", "recreation_ground", "village_green", "golf_course"]]],
      "paint": { "fill-color": "#f2f6f1", "fill-opacity": 1 }
    },
    {
      "id": "grassland",
      "type": "fill",
      "source": "openmaptiles",
      "source-layer": "landcover",
      "minzoom": 7,
      "filter": ["in",["get","subclass"],["literal",["grass","grassland","fell"]]],
      "paint": { "fill-color": "#eef3ee", "fill-opacity": 1 }
    },
    {
      "id": "heath",
      "type": "fill",
      "source": "openmaptiles",
      "source-layer": "landcover",
      "minzoom": 7,
      "filter": ["in",["get","subclass"],["literal",["heath"]]],
      "paint": { "fill-color": "#f0eeed", "fill-opacity": 1 }
    },
    {
      "id": "scrub",
      "type": "fill",
      "source": "openmaptiles",
      "source-layer": "landcover",
      "minzoom": 7,
      "filter": ["in",["get","subclass"],["literal",["scrub","shrubbery"]]],
      "paint": { "fill-color": "#eaefe8", "fill-opacity": 1 }
    },
    {
      "id": "meadow",
      "type": "fill",
      "source": "openmaptiles",
      "source-layer": "landcover",
      "minzoom": 7,
      "filter": ["in",["get","subclass"],["literal",["meadow"]]],
      "paint": { "fill-color": "#f1f4ea", "fill-opacity": 1 }
    },
    {
      "id": "tundra",
      "type": "fill",
      "source": "openmaptiles",
      "source-layer": "landcover",
      "minzoom": 5,
      "filter": ["in",["get","subclass"],["literal",["tundra"]]],
      "paint": { "fill-color": "#f3f1ee", "fill-opacity": 1 }
    },
    {
      "id": "beach",
      "type": "fill",
      "source": "openmaptiles",
      "source-layer": "landcover",
      "minzoom": 6,
      "filter": ["in",["get","subclass"],["literal",["beach"]]],
      "paint": { "fill-color": "#faf6ee", "fill-opacity": 1 }
    },
    {
      "id": "dunes",
      "type": "fill",
      "source": "openmaptiles",
      "source-layer": "landcover",
      "minzoom": 6,
      "filter": ["in",["get","subclass"],["literal",["dune"]]],
      "paint": { "fill-color": "#f8f4eb", "fill-opacity": 1 }
    },
    {
      "id": "sand",
      "type": "fill",
      "source": "openmaptiles",
      "source-layer": "landcover",
      "minzoom": 6,
      "filter": ["in",["get","subclass"],["literal",["sand"]]],
      "paint": { "fill-color": "#fbf8f0", "fill-opacity": 1 }
    },
    {
      "id": "wetland",
      "type": "fill",
      "source": "openmaptiles",
      "source-layer": "landcover",
      "minzoom": 7,
      "filter": ["in",["get","subclass"],["literal",["wetland","wet_meadow"]]],
      "paint": { "fill-color": "#edf3f3", "fill-opacity": 1 }
    },
    {
      "id": "bog",
      "type": "fill",
      "source": "openmaptiles",
      "source-layer": "landcover",
      "minzoom": 7,
      "filter": ["in",["get","subclass"],["literal",["bog"]]],
      "paint": { "fill-color": "#ecf0ed", "fill-opacity": 1 }
    },
    {
      "id": "marsh",
      "type": "fill",
      "source": "openmaptiles",
      "source-layer": "landcover",
      "minzoom": 7,
      "filter": ["in",["get","subclass"],["literal",["marsh","swamp"]]],
      "paint": { "fill-color": "#e9f0ec", "fill-opacity": 1 }
    },
    {
      "id": "reedbed",
      "type": "fill",
      "source": "openmaptiles",
      "source-layer": "landcover",
      "minzoom": 7,
      "filter": ["in",["get","subclass"],["literal",["reedbed"]]],
      "paint": { "fill-color": "#eaf0e6", "fill-opacity": 1 }
    },
    {
      "id": "tidalflat",
      "type": "fill",
      "source": "openmaptiles",
      "source-layer": "landcover",
      "minzoom": 6,
      "filter": ["in",["get","subclass"],["literal",["tidalflat","saltmarsh","saltern"]]],
      "paint": { "fill-color": "#f1f2ed", "fill-opacity": 1 }
    },
    {
      "id": "mangrove",
      "type": "fill",
      "source": "openmaptiles",
      "source-layer": "landcover",
      "minzoom": 7,
      "filter": ["in",["get","subclass"],["literal",["mangrove"]]],
      "paint": { "fill-color": "#e7efea", "fill-opacity": 1 }
    },
    {
      "id": "farmland",
      "type": "fill",
      "source": "openmaptiles",
      "source-layer": "landcover",
      "minzoom": 7,
      "filter": ["in",["get","subclass"],["literal",["farmland","farm"]]],
      "paint": { "fill-color": "#f5f4ed", "fill-opacity": 1 }
    },
    {
      "id": "orchard",
      "type": "fill",
      "source": "openmaptiles",
      "source-layer": "landcover",
      "minzoom": 8,
      "filter": ["in",["get","subclass"],["literal",["orchard"]]],
      "paint": { "fill-color": "#f0f3ea", "fill-opacity": 1 }
    },
    {
      "id": "vineyard",
      "type": "fill",
      "source": "openmaptiles",
      "source-layer": "landcover",
      "minzoom": 8,
      "filter": ["in",["get","subclass"],["literal",["vineyard"]]],
      "paint": { "fill-color": "#f3f0ec", "fill-opacity": 1 }
    },
    {
      "id": "allotments",
      "type": "fill",
      "source": "openmaptiles",
      "source-layer": "landcover",
      "minzoom": 9,
      "filter": ["in",["get","subclass"],["literal",["allotments"]]],
      "paint": { "fill-color": "#f2f2ec", "fill-opacity": 1 }
    },
    {
      "id": "nursery",
      "type": "fill",
      "source": "openmaptiles",
      "source-layer": "landcover",
      "minzoom": 9,
      "filter": ["in",["get","subclass"],["literal",["plant_nursery"]]],
      "paint": { "fill-color": "#edf1ea", "fill-opacity": 1 }
    },
    {
      "id": "rock",
      "type": "fill",
      "source": "openmaptiles",
      "source-layer": "landcover",
      "minzoom": 5,
      "filter": ["in",["get","subclass"],["literal",["bare_rock"]]],
      "paint": { "fill-color": "#f0f0f1", "fill-opacity": 1 }
    },
    {
      "id": "scree",
      "type": "fill",
      "source": "openmaptiles",
      "source-layer": "landcover",
      "minzoom": 6,
      "filter": ["in",["get","subclass"],["literal",["scree"]]],
      "paint": { "fill-color": "#f2f1f1", "fill-opacity": 1 }
    },
    {
      "id": "glacier",
      "type": "fill",
      "source": "openmaptiles",
      "source-layer": "landcover",
      "minzoom": 0,
      "filter": ["in",["get","subclass"],["literal",["glacier","ice_shelf"]]],
      "paint": { "fill-color": "#f7fafc", "fill-opacity": 1 }
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
        "fill-outline-color": "rgba(0,0,0,0)"
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
        "fill-outline-color": "rgba(0,0,0,0)"
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

// Every geographic polygon has three independent renderers:
// fill color, optional translucent hatch overlay, and editable outline.
// Background/land is not a polygon and intentionally has no border or hatch.
for (let index = 0; index < environmentStyle.layers.length; index++) {
  const fill = environmentStyle.layers[index];
  if (fill.type !== 'fill') continue;
  const outlineColor = fill.id === 'water' ? '#dce3e8' :
    fill.id === 'building' ? '#dddddf' : '#c6c9c6';
  // Do not use fill-outline-color: a dedicated line layer also supports
  // editable thickness and dashes, and draws over the hatch.
  fill.paint['fill-outline-color'] = 'rgba(0,0,0,0)';
  const shared = {
    source: fill.source,
    'source-layer': fill['source-layer'],
    ...(fill.filter ? { filter: fill.filter } : {}),
    ...(fill.minzoom !== undefined ? { minzoom: fill.minzoom } : {}),
    ...(fill.maxzoom !== undefined ? { maxzoom: fill.maxzoom } : {})
  };
  environmentStyle.layers.splice(index + 1, 0,
    {
      id: fill.id + '-hatch', type: 'fill', ...shared,
      layout: { visibility: 'none' },
      paint: { 'fill-opacity': 0.55, 'fill-outline-color': 'rgba(0,0,0,0)' }
    },
    {
      id: fill.id + '-outline', type: 'line', ...shared,
      paint: { 'line-color': outlineColor, 'line-width': 0.85 }
    }
  );
  index += 2;
}
