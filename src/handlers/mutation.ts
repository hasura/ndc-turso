import { MutationOperation, MutationOperationResults, MutationRequest, MutationResponse, NotSupported } from "@hasura/ndc-sdk-typescript";
import { Configuration, State } from "..";


export async function do_mutation(configuration: Configuration, state: State, mutation: MutationRequest): Promise<MutationResponse> {
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
            const client = state.client;
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
    return {
        operation_results: operation_results
    };
}