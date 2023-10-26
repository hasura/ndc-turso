import { ExplainResponse, QueryRequest } from "@hasura/ndc-sdk-typescript";
import { Configuration } from "..";
// import { ParameterizedQuery, planQueries } from "./query";
import { planQueries, SQLiteQuery } from "./query";

export async function doExplain(configuration: Configuration, query: QueryRequest): Promise<ExplainResponse>{
    let queryPlans: SQLiteQuery[] = await planQueries(
        configuration,
        query
      );
    let explainResponse: ExplainResponse = {
        details: {
            queryPlans: JSON.stringify(queryPlans)
        }
    };
    return explainResponse;
}