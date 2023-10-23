import {
  QueryRequest,
  Expression,
  QueryResponse,
  RowSet,
  BadRequest,
  NotSupported,
  InternalServerError,
  Query
} from "@hasura/ndc-sdk-typescript";
import { Configuration } from "..";
import { getTursoClient } from "../turso";
import { MAX_32_INT } from "../constants";
import { format } from "sql-formatter";
const SqlString = require("sqlstring-sqlite");
const escapeSingle = (s: any) => SqlString.escape(s);
const escapeDouble = (s: any) => `"${SqlString.escape(s).slice(1, -1)}"`;
// import {v4 as uuid} from 'uuid'; 
// We don't need a random suffix, if we treat the node-tree like a path and alias the tables as we go down the path.
// Pros: It makes things easier to read, and it removes the cost of generating a random suffix
// Cons: It might make the queries longer for deeply nested queries, if there's a limit on the length of the SQL query, this could be a problem, but it's unlikely except for the most extreme cases.


// Do we need to use args at all?
// That's terrible, I know. BUT.. is it?
// Our Connector is sitting behind a strictly typed graph.
// If the connector isn't fully open and unsecured, then we can trust that the graph is only going to send us valid data.
// Since everything passes through our engine, as long as the connector is secure, we should be able to plop things in. 
// Although, it's trivial when you use a post-order walk, since you can just push the args onto the stack as you go down the tree.


type QueryVariables = {
  [key: string]: any;
};

type SQLiteQuery = {
  sql: string;
  args: any[];
};

function wrapData(s: string): string {
  return `
SELECT
(
  ${s}
) as data
`;
}

function wrapRows(s: string): string {
  return `
SELECT
  JSON_OBJECT('rows', JSON_GROUP_ARRAY(JSON(r)))
FROM
  (
    ${s}
  )
`;
}

function buildWhere(expression: Expression, args: any[], variables: QueryVariables): string {
  let sql = "";
  switch (expression.type) {
    case "unary_comparison_operator":
      switch (expression.operator) {
        case "is_null":
          sql = `${expression.column.name} IS NULL`;
          break;
        default:
          throw new BadRequest("Unknown Unary Comparison Operator", {
            "Unknown Operator": "This should never happen.",
          });
      }
      break;
    case "binary_comparison_operator":
      switch (expression.value.type) {
        case "scalar":
          args.push(expression.value.value);
          break;
        case "variable":
          if (variables !== null) {
            args.push(variables[expression.value.name]);
          }
          break;
        case "column":
          throw new BadRequest("Not implemented", {});
        default:
          throw new BadRequest("Unknown Binary Comparison Value Type", {});
      }
      switch (expression.operator.type) {
        case "equal":
          sql = `${expression.column.name} = ?`;
          break;
        case "other":
          switch (expression.operator.name) {
            case "like":
              args[args.length - 1] = `%${args[args.length - 1]}%`;
              sql = `${expression.column.name} LIKE ?`;
              break;
            case "gt":
              sql = `${expression.column.name} > ?`;
              break;
            case "lt":
              sql = `${expression.column.name} < ?`;
              break;
            case "gte":
              sql = `${expression.column.name} >= ?`;
              break;
            case "lte":
              sql = `${expression.column.name} <= ?`;
              break;
            default:
              throw new NotSupported("Invalid Expression Operator Name", {});
          }
          break;
        default:
          throw new BadRequest(
            "Binary Comparison Custom Operator not implemented",
            {}
          );
      }
      break;
    case "and":
      if (expression.expressions.length === 0) {
        sql = "1";
      } else {
        const clauses = [];
        for (const expr of expression.expressions) {
          const res = buildWhere(expr, args, variables);
          clauses.push(res);
        }
        sql = `(${clauses.join(` AND `)})`;
      }
      break;
    case "or":
      if (expression.expressions.length === 0) {
        sql = "1";
      } else {
        const clauses = [];
        for (const expr of expression.expressions) {
          const res = buildWhere(expr, args, variables);
          clauses.push(res);
        }
        sql = `(${clauses.join(` OR `)})`;
      }
      break;
    case "not":
      const notResult = buildWhere(expression.expression, args, variables);
      sql = `NOT (${notResult})`;
      break;
    case "binary_array_comparison_operator":
      // IN
      throw new BadRequest("In not implemented", {});
    case "exists":
      // EXISTS
      throw new BadRequest("Not implemented", {});
    default:
      throw new BadRequest("Unknown Expression Type!", {});
  }
  return sql;
}

function buildQuery(
  config: Configuration,
  queryRequest: QueryRequest,
  collection: string,
  query: Query,
  path: string[],
  variables: QueryVariables,
  args: any[]
): SQLiteQuery {
  let sql = "";
  path.push(collection);
  let collection_alias = path.join("_");
  let indent = "    ".repeat(path.length - 1);

  let limit_sql = ``;
  let offset_sql = ``;
  let order_by_sql = ``;
  let collectRows = [];
  let where_conditions = ["WHERE 1"];
  if (query.aggregates) {
    // TODO: Add each aggregate to collectRows
  }
  if (query.fields) {
    for (let [fieldName, fieldValue] of Object.entries(query.fields)) {
      collectRows.push(escapeSingle(fieldName));
      switch (fieldValue.type) {
        case "column":
          collectRows.push(escapeDouble(fieldValue.column));
          break;
        case "relationship":
          collectRows.push(
            `(${
              (
                buildQuery(
                  config,
                  queryRequest,
                  fieldValue.relationship,
                  fieldValue.query,
                  path,
                  variables,
                  args
                )
              ).sql
            })`
          );
          path.pop();
          break;
        default:
          throw new BadRequest("The types tricked me. 😭", {});
      }
    }
  }
  let from_sql = `${escapeDouble(collection)} as ${escapeDouble(
    collection_alias
  )}`;
  if (path.length > 1) {
    // We don't need the field-mappings since I conveniently had those stored in the config data.
    // Since we can trust the target_collection to be correct even if the field mappings are off, we can look them up.
    let relationship = queryRequest.collection_relationships[collection];
    let parent_alias = path.slice(0, -1).join("_");

    from_sql = `${escapeDouble(
      relationship.target_collection
    )} as ${escapeDouble(collection_alias)}`;

    // where_conditions.push(
    //   ...Object.entries(relationship.column_mapping).map(([from, to]) => {
    //     return `${escapeDouble(parent_alias)}.${escapeDouble(from)} = ${escapeDouble(collection_alias)}.${escapeDouble(to)}`;
    //   })
    // );

    let parent_lookup = path[path.length - 2];
    let parent: string = parent_lookup;
    if (queryRequest.collection_relationships[parent_lookup] !== undefined){
      parent = queryRequest.collection_relationships[parent_lookup].target_collection;
    }

    if (!config.config){
      throw new BadRequest("Darn types.", {});
    }

    let target_keys_lookup = config.config.object_fields[relationship.target_collection];
    
    for (let [key, keyData] of Object.entries(target_keys_lookup.foreign_keys)){
      if (keyData.table === parent){
        where_conditions.push(`${escapeDouble(parent_alias)}.${escapeDouble(key)} = ${escapeDouble(collection_alias)}.${escapeDouble(keyData.column)}`);
      }
    }

  }

  if (query.where){
    where_conditions.push(`(${buildWhere(query.where, args, variables)})`);
  }

  if (query.order_by){
    let order_elems: string[] = [];
    for (let elem of query.order_by.elements){
      switch (elem.target.type){
        case "column":
          order_elems.push(`${escapeDouble(elem.target.name)} ${elem.order_direction}`);
          break;
        case "single_column_aggregate":
          throw new NotSupported("Single Column Aggregate not supported yet", {});
        case "star_count_aggregate":
          throw new NotSupported("Single Column Aggregate not supported yet", {});
        default:
          throw new BadRequest("The types lied 😭", {});
      }
    }
    if (order_elems.length > 0){
      order_by_sql = `ORDER BY ${order_elems.join(" , ")}`;
    }
  }

  if (query.limit) {
    limit_sql = `LIMIT ${escapeSingle(query.limit)}`;
  }

  if (query.offset) {
    if (!query.limit){
      limit_sql = `LIMIT ${MAX_32_INT}`;
    }
    offset_sql = `OFFSET ${escapeSingle(query.offset)}`;
  }
  
  sql = wrapRows(`
SELECT
JSON_OBJECT(${collectRows.join(",")}) as r
FROM ${from_sql}
${where_conditions.join(" AND ")}
${order_by_sql}
${limit_sql}
${offset_sql}
`);

  if (path.length === 1) {
    sql = wrapData(sql);
    // console.log(format(sql, { language: "sqlite" }));
  }

  return {
    sql,
    args,
  };
}

async function planQueries(
  configuration: Configuration,
  query: QueryRequest
): Promise<SQLiteQuery[]> {
  if (!configuration.config) {
    throw new InternalServerError("Connector is not properly configured", {});
  }

  let queryPlan: SQLiteQuery[];
  if (query.variables) {
    let promises = query.variables.map((varSet) => {
      let queryVariables: QueryVariables = varSet;
      return buildQuery(
        configuration,
        query,
        query.collection,
        query.query,
        [],
        queryVariables,
        []
      );
    });
    queryPlan = await Promise.all(promises);
  } else {
    let promise = buildQuery(
      configuration,
      query,
      query.collection,
      query.query,
      [],
      {},
      []
    );
    queryPlan = [promise];
  }
  return queryPlan;
}

async function performQuery(
  configuration: Configuration,
  queryPlans: SQLiteQuery[]
): Promise<QueryResponse> {
  const client = getTursoClient(configuration.credentials);
  const results = await client.batch(queryPlans);
  let res = results.map((r) => {
    let rowSet = JSON.parse(r.rows[0].data as string) as RowSet;
    return rowSet;
  });
  return res;
}

export async function doQuery(
  configuration: Configuration,
  query: QueryRequest
): Promise<QueryResponse> {
  // console.log(JSON.stringify(query, null, 4));
  // console.log(JSON.stringify(configuration), null, 4);
  let queryPlans = await planQueries(configuration, query);
  return await performQuery(configuration, queryPlans);
}
