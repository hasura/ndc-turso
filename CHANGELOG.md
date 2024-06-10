# Turso Connector Changelog
This changelog documents changes between release tags.


## [Unreleased]
Upcoming changes for the next versioned release.

## [0.0.15]
* Fix mutations

## [0.0.14]
* Change orderBy to use default casing. (Ordering is case-sensitive and uses underlying implementation which differs from Postgres)

## [0.0.13]
* Fix platforms for multi-arch build

## [0.0.12]
* Fix multi-arch build
* Fix OrderBy filtering

## [0.0.11]
* Update SDK to 4.5.0
* Update packaging to use a Dockerized Command
* Fix generate-config to only re-write the config if the introspection results are different

## [0.0.10]
* Fix Error Handling so messages pass through to GraphQL engine

## [0.0.9]
* Fix bug in filter joins

## [0.0.8]
* Update connector-metadata.yaml

## [0.0.7]
* Fix the connector-metadata.yaml
* Add check for if environment variables are a blank string for optional env vars

## [0.0.6]
* Fixing github workflow

## [0.0.5] - 2024-03-12
* Fixing github workflow

## [0.0.4] - 2024-03-12
Initial release