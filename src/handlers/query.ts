import {
  QueryRequest,
  Expression,
  QueryResponse,
  RowSet,
  RowFieldValue,
  BadRequest,
  Conflict,
  NotSupported,
  InternalServerError,
  OrderBy,
} from "@hasura/ndc-sdk-typescript";
import { Configuration } from "..";
import { getTursoClient } from "../turso";

type VarSet = {
  [key: string]: any;
};

type ParameterizedQuery = {
  sql: string;
  args: any[];
  aggregates: string[];
};

function recursiveBuildWhere(
  expression: Expression,
  varSet: VarSet | null
): ParameterizedQuery {
  let args = [];
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
          if (varSet !== null) {
            args.push(varSet[expression.value.name]);
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
          const res = recursiveBuildWhere(expr, varSet);
          clauses.push(res.sql);
          args.push(...res.args);
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
          const res = recursiveBuildWhere(expr, varSet);
          clauses.push(res.sql);
          args.push(...res.args);
        }
        sql = `(${clauses.join(` OR `)})`;
      }
      break;
    case "not":
      const notResult = recursiveBuildWhere(expression.expression, varSet);
      sql = `NOT (${notResult.sql})`;
      args = notResult.args;
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
  return {
    sql: sql,
    args: args,
    aggregates: [],
  };
}

function buildOrderBy(orderBy: OrderBy): string {
  const orderElements = orderBy.elements.map((element) => {
    let targetField = "";
    switch (element.target.type) {
      case "column":
        targetField = element.target.name;
        break;
      case "single_column_aggregate":
        throw new NotSupported("Not implemented", {});
      case "star_count_aggregate":
        throw new NotSupported("Not implemented", {});
    }
    return `${targetField} ${element.order_direction.toUpperCase()}`;
  });
  if (orderElements.length === 0) {
    return ``;
  }
  return `ORDER BY ${orderElements.join(", ")}`;
}

/**
 *
 * @param query The queryRequest
 * @param includedFields Which fields to include when building the response
 * @param varSet The variables for this specific query
 */
export async function collectQuery(
  query: QueryRequest,
  includedFields: string[],
  varSet: VarSet | null
): Promise<ParameterizedQuery> {
  let sqlite_statement: string = "";
  let args = [];
  let aggregates = [];
  let joins: string[] = [];
  let columns: string[] = [];

  includedFields.forEach((field) => {
    if (query.query.fields !== null && query.query.fields !== undefined) {
      const rel = query.collection_relationships[field];
      const f = query.query.fields[field];

      if (f.type === "relationship") {
        const baseTable = query.collection.slice(0, -1);
        if (rel.relationship_type === "object") {
          if (f.query.fields){
            const joinTable = rel.target_collection.slice(0, -1);
            const joinClauses = Object.entries(rel.column_mapping).map(
              ([sourceColumn, targetColumn]) => {
                return `${baseTable}.${sourceColumn} = ${joinTable}.${targetColumn}`;
              }
            );
            const joinCondition = joinClauses.join(" AND ");
            Object.keys(f.query.fields).forEach((relField) => {
              columns.push(
                `${joinTable}.${relField} AS "${joinTable}.${relField}"`
              );
            });
            const joinClause = `JOIN ${joinTable} ON ${joinCondition}`;
            joins.push(joinClause);
          }
        } else if (rel.relationship_type === "array") {
          // TODO: Handle these with a CTE?
          throw new BadRequest("Array Relationships not implemented", {});
        }
      } else if (f.type === "column") {
        columns.push(`${query.collection.slice(0, -1)}.${f.column}`);
      }
    }
  });

  let cte = "";
  if (query.query.aggregates) {
    // Create a CTE for aggregate calculations
    cte = "WITH aggregate_cte AS (SELECT ";
    let aggregate_statements = [];
    for (const [key, aggregate] of Object.entries(query.query.aggregates)) {
      switch (aggregate.type) {
        case "single_column":
          switch (aggregate.function) {
            case "sum":
              aggregate_statements.push(`SUM(${aggregate.column}) AS ${key}`);
              aggregates.push(key);
              break;
            case "avg":
              aggregate_statements.push(`AVG(${aggregate.column}) AS ${key}`);
              aggregates.push(key);
              break;
            default:
              throw new BadRequest(
                `Unsupported aggregate function: ${aggregate.function}`,
                {}
              );
          }
          break;
        case "column_count":
          if (aggregate.distinct) {
            aggregate_statements.push(
              `COUNT(DISTINCT ${aggregate.column}) AS ${key}`
            );
            aggregates.push(key);
          } else {
            aggregate_statements.push(`COUNT(${aggregate.column}) AS ${key}`);
            aggregates.push(key);
          }
          break;
        case "star_count":
          aggregate_statements.push(`COUNT(*) AS ${key}`);
          aggregates.push(key);
          break;
        default:
          throw new BadRequest(`Unsupported aggregate type`, {});
      }
    }
    cte += aggregate_statements.join(", ");
    cte += ` FROM ${query.collection.slice(0, -1)}) `;
    // In the main query, select from the CTE
    for (const key of Object.keys(query.query.aggregates)) {
      columns.push(`(SELECT ${key} FROM aggregate_cte) AS ${key}`);
    }
  }

  sqlite_statement = cte + "SELECT " + columns.join(", ");
  sqlite_statement += ` FROM ${query.collection.slice(0, -1)}`;

  if (joins.length > 0) {
    sqlite_statement += ` ${joins.join(" ")}`;
  }
  if (query.query.where) {
    const q = recursiveBuildWhere(query.query.where, varSet);
    sqlite_statement += ` WHERE ${q.sql}`;
    args.push(...q.args);
  }

  if (query.query.order_by) {
    sqlite_statement += ` ${buildOrderBy(query.query.order_by)}`;
  }

  if (typeof query.query.limit !== "undefined") {
    sqlite_statement += ` LIMIT ${query.query.limit}`;
  }

  if (typeof query.query.offset !== "undefined") {
    sqlite_statement += ` OFFSET ${query.query.offset}`;
  }

  // Add a semicolon to terminate the SQL statement
  sqlite_statement += ";";
  return {
    sql: sqlite_statement,
    args: args,
    aggregates: aggregates,
  };
}

async function performQueries(
  configuration: Configuration,
  queryPlans: ParameterizedQuery[]
): Promise<RowSet[]> {
  const client = getTursoClient(configuration.credentials);
  const results = await client.batch(queryPlans);
  let rowSets: RowSet[] = results.map((result, index) => {
    let aggResults: { [key: string]: any } = {};
    let queryPlan = queryPlans[index];
    const rows = result.rows.map((row) => {
      let singleRowObj: { [k: string]: RowFieldValue | any } = {};
      result.columns.forEach((column, idx) => {
        if (column.includes(".[].")) {
          throw new BadRequest("Not implemented", {});
        } else if (column.includes(".")) {
          const parts = column.split(".");
          if (!singleRowObj[parts[0]]) {
            singleRowObj[parts[0]] = {};
          }
          if (!singleRowObj[parts[0]].rows) {
            singleRowObj[parts[0]].rows = [{}]; // Initialize with an empty object inside the array
          }
          singleRowObj[parts[0]].rows[0][parts[1]] = row[
            idx
          ] as unknown as RowFieldValue;
        } else if (queryPlan.aggregates.includes(column)) {
          if (!aggResults[column]){
            aggResults[column] = row[idx];
          }
        } else {
          singleRowObj[column] = row[idx] as unknown as RowFieldValue;
        }
      });
      return singleRowObj;
    }).filter(obj => Object.keys(obj).length > 0);
    let rowSet: RowSet = {};
    if (rows.length > 0) {
      rowSet.rows = rows;
    }
    if (Object.keys(aggResults).length > 0){
      rowSet.aggregates = aggResults
    }
    return rowSet;
  });
  return rowSets;
}

/**
 *
 * @param configuration The configuration objecty
 * @param query The query Request
 */
export async function planQueries(
  configuration: Configuration,
  query: QueryRequest
): Promise<ParameterizedQuery[]> {
  if (!configuration.config) {
    throw new InternalServerError("Connector is not properly configured", {});
  }
  let queryFields: string[] = [];
  if (query.query.fields !== null && query.query.fields !== undefined) {
    queryFields = Object.keys(query.query.fields);
  }
  let queryResponse: ParameterizedQuery[];
  if (query.variables) {
    let promises = query.variables.map((varSet) => {
      let vSet: VarSet = varSet;
      return collectQuery(query, queryFields, vSet);
    });
    queryResponse = await Promise.all(promises);
  } else {
    let res = await collectQuery(query, queryFields, null);
    queryResponse = [res];
  }
  return queryResponse;
}

export async function doQuery(
  configuration: Configuration,
  query: QueryRequest
): Promise<QueryResponse> {
  console.log(JSON.stringify(query, null, 4));
  let queryPlans: ParameterizedQuery[] = await planQueries(
    configuration,
    query
  );
  console.log("Query Plans ", JSON.stringify(queryPlans, null, 4));
  return await performQueries(configuration, queryPlans);
}
