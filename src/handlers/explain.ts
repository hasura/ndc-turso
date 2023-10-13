import { ExplainResponse, QueryRequest } from "@hasura/ndc-sdk-typescript";
import { Configuration } from "..";
// import { QueryPlan, planQueries } from "./query";

export async function doExplain(configuration: Configuration, query: QueryRequest): Promise<ExplainResponse>{
    let explainResponse: ExplainResponse = {
        details: {}
    };
    return explainResponse;
}