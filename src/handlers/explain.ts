import { ExplainResponse, QueryRequest } from "@hasura/ndc-sdk-typescript";
import { Configuration } from "..";
import { plan_queries, SQLiteQuery } from "./query";

export async function do_explain(configuration: Configuration, query: QueryRequest): Promise<ExplainResponse>{
    let query_plans: SQLiteQuery[] = await plan_queries(
        configuration,
        query
      );
    let explain_response: ExplainResponse = {
        details: {
            query_plans: JSON.stringify(query_plans)
        }
    };
    return explain_response;
}