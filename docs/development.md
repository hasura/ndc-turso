# Turso Connector Development

### Prerequisites
1. Follow the steps in the [README](../README.md)
2. Install [NodeJS & npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)

### Clone the repo

In a new directory, clone the repo using:

```git clone https://github.com/hasura/ndc-turso```

### Run the Introspection

If you are working with a local database file, place the file in the root of the ndc-turso directory. 

Assuming the file is named: `chinook.sqlite` you can run the introspection using:

```TURSO_URL=file:chinook.sqlite ts-node generate-config```

If you are working with a MotherDuck hosted database, you can run the introspection using:

```TURSO_URL=libsql://chinook-tristenharr.turso.io TURSO_AUTH_TOKEN=eyJh... ts-node generate-config```

This will generate a `config.json` file.

### Run the Connector

To start the connector on port 9094, for a local file named `chinook.sqlite` run:
```HASURA_CONNECTOR_PORT=9094 TURSO_URL=file:chinook.sqlite ts-node ./src/index.ts serve --configuration=.```

To start the connector on port 9094, for a Turso hosted database instance run:
```HASURA_CONNECTOR_PORT=9094 TURSO_URL=libsql://chinook-tristenharr.turso.io TURSO_AUTH_TOKEN=eyJh... ts-node ./src/index.ts serve --configuration=.```

### Attach the connector to the locally running engine

There should a file located at `.env` that contains 

```env
APP_TURSO_READ_URL="http://local.hasura.dev:<port>"
APP_TURSO_WRITE_URL="http://local.hasura.dev:<port>"
```

Edit the values in the `.env` file to point at port 9094 with the locally running connector.

```env
APP_TURSO_READ_URL="http://local.hasura.dev:9094"
APP_TURSO_WRITE_URL="http://local.hasura.dev:9094"
```

Do a local supergraph build:

```ddn supergraph build local```

Mutations and Queries will now be issued against your locally running connector instance. 

Depending on the changes made to the connector, you may need to re-generate the config. The best way to do this is to regenerate the config locally then move that config into the supergraph.