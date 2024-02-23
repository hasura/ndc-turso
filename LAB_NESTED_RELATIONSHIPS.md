query SimplestNest {
  album(where: {Artist: {Name: {_eq: "Accept"}}}) {
    AlbumId
  }
}

Has a path:
"path": [
    {
        "relationship": "[{\"subgraph\":\"default\",\"name\":\"Album\"},\"Artist\"]",
        "arguments": {},
        "predicate": {
            "type": "and",
            "expressions": []
        }
    }
]

CURRENTLY OUTPUTS:
SELECT
  (
    SELECT
      JSON_OBJECT('rows', JSON_GROUP_ARRAY(JSON(r)))
    FROM
      (
        SELECT
          JSON_OBJECT('AlbumId', "AlbumId") as r
        FROM
          "Album" as "Album"
        WHERE
          1
          AND (Name = ?)
      )
  ) as data

Needs to output:

Because it needs a JOIN!

SELECT
  (
    SELECT
      JSON_OBJECT('rows', JSON_GROUP_ARRAY(JSON(r)))
    FROM
      (
        SELECT
          JSON_OBJECT('AlbumId', "AlbumId") as r
        FROM
          "Album" as "Album"
        JOIN "Artist" ON "Album"."ArtistId" = "Artist"."ArtistId"
        WHERE
          1
          AND ("Artist"."Name" = "Accept")
      )
  ) as data



Double Nested

query DoubleNest {
  track(where: {Album: {Artist: {Name: {_eq: "AC/DC"}}}}) {
    AlbumId
  }
}

QUERY


{
    "collection": "Track",
    "query": {
        "fields": {
            "AlbumId": {
                "type": "column",
                "column": "AlbumId",
                "fields": null
            }
        },
        "predicate": {
            "type": "binary_comparison_operator",
            "column": {
                "type": "column",
                "name": "Name",
                "path": [
                    {
                        "relationship": "[{\"subgraph\":\"default\",\"name\":\"Track\"},\"Album\"]",
                        "arguments": {},
                        "predicate": {
                            "type": "and",
                            "expressions": []
                        }
                    },
                    {
                        "relationship": "[{\"subgraph\":\"default\",\"name\":\"Album\"},\"Artist\"]",
                        "arguments": {},
                        "predicate": {
                            "type": "and",
                            "expressions": []
                        }
                    }
                ]
            },
            "operator": "_eq",
            "value": {
                "type": "scalar",
                "value": "AC/DC"
            }
        }
    },
    "arguments": {},
    "collection_relationships": {}
}