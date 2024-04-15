## Turso Connector

The Turso Data Connector allows for connecting to a SQLite database. This connector uses the [Typescript Data Connector SDK](https://github.com/hasura/ndc-sdk-typescript) and implements the [Data Connector Spec](https://github.com/hasura/ndc-spec). 

### Setting up the Turso connector using Hasura Cloud & a Turso database

#### Step 1: Prerequisites

1. Install the [new Hasura CLI](https://hasura.io/docs/3.0/cli/installation/) — to quickly and easily create and manage your Hasura projects and builds.
2. Install the [Hasura VS Code extension](https://marketplace.visualstudio.com/items?itemName=HasuraHQ.hasura) — with support for other editors coming soon!
3. Have a [Turso](https://turso.tech/) database — for supplying data to your API.

#### Step 2: Login to Hasura

After our prerequisites are taken care of, login to Hasura Cloud with the CLI:

`ddn login`

This will open up a browser window and initiate an OAuth2 login flow. If the browser window doesn't open automatically, use the link shown in the terminal output to launch the flow.

#### Step 3: Create a new project

We'll use the `create project` command to create a new project:

`ddn create project --dir ./ddn`

#### Step 4: Add a connector manifest

Let's move into the project directory:

`cd ddn`

Create a subgraph:

`ddn create subgraph turso`

Then, create a connector manifest:
`ddn add connector-manifest turso_connector --subgraph turso --hub-connector hasura/turso --type cloud`

#### Step 5: Edit the connector manifest

You should have a connector manifest created at `ddn/turso/turso_connector/connector/turso_connector.build.hml`

```yaml
kind: ConnectorManifest
version: v1
spec:
  supergraphManifests:
    - base
definition:
  name: turso_connector
  type: cloud
  connector:
    type: hub
    name: hasura/turso:v0.0.10
  deployments:
    - context: .
      env:
        TURSO_AUTH_TOKEN:
          value: ""
        TURSO_URL:
          value: ""
```

Fill in the value for the TURSO_AUTH_TOKEN and TURSO_URL environment variables with your Turso credentials.

(Make sure to save your changes to the file!)

#### Step 6: Start a development session

Start a Hasura dev session using the following command:

`ddn dev`

You should see something like this if the connector has been deployed successfully: 

```
4:13PM INF Building SupergraphManifest "base"...
+---------------+----------------------------------------------------------------------------------------------------+
| Build Version | 9c06480568                                                                                         |
+---------------+----------------------------------------------------------------------------------------------------+
| API URL       | https://optimum-dragon-2392-9c06480568.ddn.hasura.app/graphql                                      |
+---------------+----------------------------------------------------------------------------------------------------+
| Console URL   | https://console.hasura.io/project/optimum-dragon-2392/environment/default/build/9c06480568/graphql |
+---------------+----------------------------------------------------------------------------------------------------+
| Project Name  | optimum-dragon-2392                                                                                |
+---------------+----------------------------------------------------------------------------------------------------+
| Description   | Dev build - Mon, 15 Apr 2024 16:13:07 CDT                                                          |
+---------------+----------------------------------------------------------------------------------------------------+
```

Navigate to your Console URL and you can issue a query or mutation.

### Setting up the Turso connector locally (Coming Soon)

Please keep an eye out for instructions on running things locally which will be coming soon. 