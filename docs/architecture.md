# General Architecture of the Turso Connector

## Query Engine
The query engine's job is to take a `QueryRequest`, which contains information about the query a user would like to run, translate it to SQL (using the SQLite dialect), execute it against the database, and return the results as a `QueryResponse`.

One place in particular that uses the Query Engine is the `/query` endpoint (defined in the `ndc-hub` repository).

`/query` endpoints receives a `QueryRequest`, and calls the `plan_queries` function from the Query Engine in order to create a QueryPlan which includes the information needed to execute the query. It then calls the `perform_query` function using the QueryPlan (which is run against Turso) and gets back a `QueryResponse` which it can then return to the caller.

API:

```typescript
export async function plan_queries(
  configuration: Configuration,
  query: QueryRequest
): Promise<SQLiteQuery[]>
```

```typescript
async function perform_query(
  state: State,
  query_plans: SQLiteQuery[]
): Promise<QueryResponse> 
```

Note that the response from this function should be in the format of an ndc-spec [QueryResponse](https://hasura.github.io/ndc-spec/reference/types.html#queryresponse) represented as JSON.

### Query Planning
The query plan is essentially side-effect free - we use information from the request as well as the information about the metadata to translate the query request into a SQL statement to run against the database.

This process is currently found in the [src/handlers](/src/handlers/query.ts) directory in the query.ts file. The API is the following function:

```typescript
export async function plan_queries(
  configuration: Configuration,
  query: QueryRequest
): Promise<SQLiteQuery[]>
```

The `plan_queries` function returns a `SQLiteQuery[]` which functions as an execution plan.

```typescript
export type SQLiteQuery = {
  sql: string;
  args: any[];
};
```

The incoming `QueryRequest` is used to construct a SQL statement by performing a recursive post-order walk over the QueryRequest to construct the SQL statement to be executed. The different pieces of the query are computed and then the query is constructed. 

```typescript
  sql = wrap_rows(`
SELECT
JSON_OBJECT(${collect_rows.join(",")}) as r
FROM ${from_sql}
${filter_joins.join("")}
${where_conditions.join(" AND ")}
${order_by_sql}
${limit_sql}
${offset_sql}
`);
```

### Query Execution
The query execution creates a connection to the database and executes the query plan against the Turso database. It then returns the results from the query back to the caller of the function.

```typescript
async function perform_query(
  state: State,
  query_plans: SQLiteQuery[]
): Promise<QueryResponse> {
  try {
    const client = state.client;
    const results = await client.batch(query_plans, "read");
    let res = results.map((r) => {
      let row_set = JSON.parse(r.rows[0].data as string) as RowSet;
      return row_set;
    });
    return res;
  } catch (e) {
    throw new Forbidden("Failed to perform Query", {error: `${e}`});
  }
}
```

## Patterns and guiding principles

Here are a few ideas I have about working with this connector.

### KISS (Keep it simple stupid!)
Robust and full-featured connector implementations should preferably be written in Rust for performance purposes. For Community Connectors it is preferred to try to keep things simple where possible, all we are doing is constructing a SQL query from the QueryRequest, which ultimately is manipulating a string. 


### Consider the generated SQL
When working on a feature or fixing a bug, consider the generated SQL first. What does it currently look like? What should it look like?

Construct what the desired query should be and make sure you can run it, and then work towards altering the SQL construction to match the hand-crafted query.
