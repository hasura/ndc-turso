import { MutationOperation, MutationOperationResults, MutationRequest, MutationResponse, NotSupported } from "@hasura/ndc-sdk-typescript";
import { Configuration, State } from "..";
import { InStatement, ResultSet } from "@libsql/client/.";

async function execute_sql_transaction(state: State, statements: InStatement[]): Promise<ResultSet[]> {
    const results = state.client.batch(statements, "write");
    return results;
}



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
            // operation_results.push({
            //     returning: [
            //         {
            //         __value: { 
            //             sync: 0 
            //         }
            //     }
            // ]
            // });
            operation_results.push(
                {
                    type: "procedure",
                    result: 0
                }
            );
        } else {
            if (procedure.name.startsWith("insert_") && procedure.name.endsWith("_one")){
                const table: string = procedure.name.slice("insert_".length, -"_one".length);
                const data = [procedure.arguments.object];
                console.log(procedure.name);
                console.log(table);
                console.log(procedure);
            } else {
                console.log("NOT COVERED");
            }
            throw new NotSupported("Not implemented yet.", {});
        }
    }
    return {
        operation_results: operation_results
    };
}