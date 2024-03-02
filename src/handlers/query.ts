import {
  QueryRequest,
  Expression,
  QueryResponse,
  RowSet,
  BadRequest,
  NotSupported,
  InternalServerError,
  Query,
} from "@hasura/ndc-sdk-typescript";
import { Configuration, State } from "..";
import { MAX_32_INT } from "../constants";
const SqlString = require("sqlstring-sqlite");
import { format } from "sql-formatter";
const escape_single = (s: any) => SqlString.escape(s);
const escape_double = (s: any) => `"${SqlString.escape(s).slice(1, -1)}"`;

// TODO: EXISTS, IN

type QueryVariables = {
  [key: string]: any;
};

export type SQLiteQuery = {
  sql: string;
  args: any[];
};

function wrap_data(s: string): string {
  return `
SELECT
(
  ${s}
) as data
`;
}

function wrap_rows(s: string): string {
  return `
SELECT
  JSON_OBJECT('rows', JSON_GROUP_ARRAY(JSON(r)))
FROM
  (
    ${s}
  )
`;
}

function build_where(
  expression: Expression,
  args: any[],
  variables: QueryVariables,
  filter_joins: string[],
  config: Configuration,
  prefix: string
): string {
  if (!config.config){
    throw new InternalServerError("Internal Server Error", {});
  }
  console.log("BUILDING EXPRESSION");
  console.log(JSON.stringify(expression, undefined, 4));
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

      const columnName = expression.column.name;
      if (expression.column.type === "column" && expression.column.path.length > 0){
        for (let path_elem of expression.column.path){
          const relationship = JSON.parse(path_elem.relationship);
          const from = relationship[0];
          const to = relationship[1];
          const from_details = config.config.object_fields[from.name];
          for (let [key, value] of Object.entries(from_details.foreign_keys)){
            if (value.table === to){
              const join_str = ` JOIN ${escape_double(to)} ON ${escape_double(from.name)}.${escape_double(key)} = ${escape_double(to)}.${escape_double(value.column)} `;
              filter_joins.push(join_str);
            }
          }
          sql = `${escape_double(to)}.${escape_double(expression.column.name)} = ?`;
        }
        break;
      }

      switch (expression.operator) {
        case "_eq":
          sql = `${prefix}.${escape_double(columnName)} = ?`;
          break;
        case "_like":
          sql = `${prefix}.${escape_double(columnName)} LIKE ?`;
          break;
        case "_glob":
          sql = `${prefix}.${escape_double(columnName)} GLOB ?`;
          break;
        case "_neq":
          sql = `${prefix}.${escape_double(columnName)} != ?`;
          break;
        case "_gt":
          sql = `${prefix}.${escape_double(columnName)} > ?`;
          break;
        case "_lt":
          sql = `${prefix}.${escape_double(columnName)} < ?`;
          break;
        case "_gte":
          sql = `${prefix}.${escape_double(columnName)} >= ?`;
          break;
        case "_lte":
          sql = `${prefix}.${escape_double(columnName)} <= ?`;
          break;
        default:
          throw new BadRequest("Binary Comparison Custom Operator not implemented", {});
      }
      break;
    case "and":
      if (expression.expressions.length === 0) {
        sql = "1";
      } else {
        const clauses = [];
        for (const expr of expression.expressions) {
          const res = build_where(expr, args, variables, filter_joins, config, prefix);
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
          const res = build_where(expr, args, variables, filter_joins, config, prefix);
          clauses.push(res);
        }
        sql = `(${clauses.join(` OR `)})`;
      }
      break;
    case "not":
      const not_result = build_where(expression.expression, args, variables, filter_joins, config, prefix);
      sql = `NOT (${not_result})`;
      break;
    case "exists":
      // EXISTS
      throw new BadRequest("Not implemented", {});
    default:
      throw new BadRequest("Unknown Expression Type!", {});
  }
  return sql;
}

function build_query(
  config: Configuration,
  query_request: QueryRequest,
  collection: string,
  query: Query,
  path: string[],
  variables: QueryVariables,
  args: any[],
  relationship_key: string | null
): SQLiteQuery {
  let sql = "";
  path.push(collection);
  let collection_alias = path.join("_");
  // let indent = "    ".repeat(path.length - 1);

  let limit_sql = ``;
  let offset_sql = ``;
  let order_by_sql = ``;
  let collect_rows = [];
  let where_conditions = ["WHERE 1"];
  if (query.aggregates) {
    // TODO: Add each aggregate to collectRows
    throw new NotSupported("Aggregates not implemented yet!", {});
  }
  if (query.fields) {
    for (let [field_name, field_value] of Object.entries(query.fields)) {
      collect_rows.push(escape_single(field_name));
      switch (field_value.type) {
        case "column":
          collect_rows.push(`${escape_double(collection)}.${escape_double(field_value.column)}`);
          break;
        case "relationship":
          collect_rows.push(
            `(${
              build_query(
                config,
                query_request,
                field_name,
                field_value.query,
                path,
                variables,
                args,
                field_value.relationship
              ).sql
            })`
          );
          path.pop(); // POST-ORDER search stack pop!
          break;
        default:
          throw new InternalServerError("The types tricked me. 😭", {});
      }
    }
  }
  let from_sql = `${escape_double(collection)} as ${escape_double(
    collection_alias
  )}`;
  if (path.length > 1 && relationship_key !== null) {
    let relationship = query_request.collection_relationships[relationship_key];
    let parent_alias = path.slice(0, -1).join("_");
    from_sql = `${escape_double(
      relationship.target_collection
    )} as ${escape_double(collection_alias)}`;
    where_conditions.push(
      ...Object.entries(relationship.column_mapping).map(([from, to]) => {
        return `${escape_double(parent_alias)}.${escape_double(
          from
        )} = ${escape_double(collection_alias)}.${escape_double(to)}`;
      })
    );
  }

  const filter_joins: string[] = [];

  if (query.predicate) {
    where_conditions.push(`(${build_where(query.predicate, args, variables, filter_joins, config, escape_double(collection))})`);
  }

  if (query.order_by) {
    let order_elems: string[] = [];
    for (let elem of query.order_by.elements) {
      switch (elem.target.type) {
        case "column":
          order_elems.push(
            `${escape_double(elem.target.name)} ${elem.order_direction}`
          );
          break;
        case "single_column_aggregate":
          throw new NotSupported(
            "Single Column Aggregate not supported yet",
            {}
          );
        case "star_count_aggregate":
          throw new NotSupported(
            "Single Column Aggregate not supported yet",
            {}
          );
        default:
          throw new BadRequest("The types lied 😭", {});
      }
    }
    if (order_elems.length > 0) {
      order_by_sql = `ORDER BY ${order_elems.join(" , ")}`;
    }
  }

  if (query.limit) {
    limit_sql = `LIMIT ${escape_single(query.limit)}`;
  }

  if (query.offset) {
    if (!query.limit) {
      limit_sql = `LIMIT ${MAX_32_INT}`;
    }
    offset_sql = `OFFSET ${escape_single(query.offset)}`;
  }

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

  if (path.length === 1) {
    sql = wrap_data(sql);
    console.log(format(sql, { language: "sqlite" }));
    console.log(args);
  }

  return {
    sql,
    args,
  };
}

export async function plan_queries(
  configuration: Configuration,
  query: QueryRequest
): Promise<SQLiteQuery[]> {
  if (!configuration.config) {
    throw new InternalServerError("Connector is not properly configured", {});
  }

  let query_plan: SQLiteQuery[];
  if (query.variables) {
    let promises = query.variables.map((var_set) => {
      let query_variables: QueryVariables = var_set;
      return build_query(
        configuration,
        query,
        query.collection,
        query.query,
        [],
        query_variables,
        [],
        null
      );
    });
    query_plan = await Promise.all(promises);
  } else {
    let promise = build_query(
      configuration,
      query,
      query.collection,
      query.query,
      [],
      {},
      [],
      null
    );
    query_plan = [promise];
  }
  return query_plan;
}

async function perform_query(
  state: State,
  query_plans: SQLiteQuery[]
): Promise<QueryResponse> {
  const client = state.client;
  const results = await client.batch(query_plans, "read");
  let res = results.map((r) => {
    let row_set = JSON.parse(r.rows[0].data as string) as RowSet;
    return row_set;
  });
  return res;
}

export async function do_query(
  configuration: Configuration,
  state: State,
  query: QueryRequest
): Promise<QueryResponse> {
  console.log("QUERY\n\n");
  console.log(JSON.stringify(query, undefined, 4));
  let query_plans = await plan_queries(configuration, query);
  return perform_query(state, query_plans);
}
