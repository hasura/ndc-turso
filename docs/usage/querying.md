# Querying Example

Hasura instrospects the database and allows for Querying a pre-existing Turso/SQLite database.

If you want to try these queries out yourself, please see [this supergraph](https://github.com/hasura/super_supergraph/tree/main).

These examples use [this SQLite file](https://github.com/hasura/super_supergraph/blob/main/turso/connector/turso/chinook.sqlite) which contains data from the Chinook Music database.

Fetch all Albums

```graphql
query Query {
  turso_album {
    albumId
    artistId
    title
  }
}
```

Fetch all Albums where Album ID = 1

```graphql
query Query {
  turso_album(where: {albumId: {_eq: 1}}) {
    albumId
    artistId
    title
  }
}
```

Fetch all Albums order by Title

```graphql
query Query {
  turso_album(order_by: {title: Asc}) {
    albumId
    artistId
    title
  }
}
```


All Albums and their Artist and Tracks

```graphql
query Query {
  turso_album {
    albumId
    artistId
    title
    artist {
      artistId
      name
    }
    tracks {
      albumId
      trackId
      name
    }
  }
}
```

All Albums where the artistID equals 10

```graphql
query Query {
  turso_album(where: {artist: {artistId: {_eq: 10}}}) {
    albumId
    artistId
    title
    artist {
      artistId
      name
    }
  }
}
```

### Additional Querying Capabilities that will be coming in the future

* Aggregations
* GroupBy