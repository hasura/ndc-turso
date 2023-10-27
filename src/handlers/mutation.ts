import { MutationOperation, MutationOperationResults, MutationRequest, MutationResponse, NotSupported } from "@hasura/ndc-sdk-typescript";
import { Configuration } from "..";
import { getTursoClient } from "../turso";


export async function doMutation(configuration: Configuration, mutation: MutationRequest): Promise<MutationResponse> {
    // Should mutations be performed synchronously? 
    let procedures: MutationOperation[] = [];
    let operation_results: MutationOperationResults[] = [];
    for (let op of mutation.operations){
        if (op.type !== "procedure"){
            throw new NotSupported("Not implemented yet.", {});
        } else {
            procedures.push(op);
        }
    }
    for (let procedure of procedures){
        if (procedure.type !== "procedure"){
            throw new NotSupported("Not implemented yet.", {});
        }
        if (procedure.name === "sync"){
            const client = getTursoClient(configuration.credentials);
            await client.sync();
            operation_results.push({
                affected_rows: 0,
                returning: [
                    {
                    __value: { 
                        sync: 0 
                    }
                }
            ]
            });
        } else {
            throw new NotSupported("Not implemented yet.", {});
        }
    }
    console.log(operation_results);
    return {
        operation_results: operation_results
    };
}