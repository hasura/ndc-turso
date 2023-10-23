import { ExplainResponse, QueryRequest } from "@hasura/ndc-sdk-typescript";
import { Configuration } from "..";
// import { ParameterizedQuery, planQueries } from "./query";

export async function doExplain(configuration: Configuration, query: QueryRequest): Promise<ExplainResponse>{
    // TODO

    // let queryPlans: ParameterizedQuery[] = await planQueries(
    //     configuration,
    //     query
    //   );
    // let explainResponse: ExplainResponse = {
    //     details: {
    //         queryPlans: JSON.stringify(queryPlans)
    //     }
    // };
    // return explainResponse;
    return {details: {}};
}