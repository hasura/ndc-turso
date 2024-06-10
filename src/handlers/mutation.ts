import { Conflict, Forbidden, MutationOperation, MutationOperationResults, MutationRequest, MutationResponse, NestedField } from "@hasura/ndc-sdk-typescript";
import { Configuration, State } from "..";
import { InArgs, InStatement, ResultSet } from "@libsql/client/.";
import { format } from "sql-formatter";

async function execute_sql_transaction(state: State, statements: InStatement[]): Promise<ResultSet[]> {
    const results = state.client.batch(statements, "write");
    return results;
}

const formatSQLWithArgs = (sql: string, args: any[]): string => {
    let index = 0;
    return sql.replace(/\?/g, () => {
      const arg = args[index++];
      if (typeof arg === 'string') {
        return `'${arg}'`;
      } else if (arg === null) {
        return 'NULL';
      } else {
        return arg;
      }
    });
  };

  function buildReturningClause(returnFields: NestedField | null | undefined): string {
    if (!returnFields || !returnFields.fields) {
        return '*'; // Default to returning all columns if returnFields is not provided
    }

    const extractColumns = (fields: { [key: string]: any }): string[] => {
        return Object.entries(fields).map(([fieldKey, fieldValue]) => {
            if (fieldValue.type === 'column') {
                return `"${fieldValue.column}" AS "${fieldKey}"`;
            }
            return null;
        }).filter(Boolean) as string[];
    };

    if (returnFields.type === 'array' && returnFields.fields?.type === 'object') {
        const columns = extractColumns(returnFields.fields.fields);
        return columns.join(", ");
    }

    if (returnFields.type === 'object') {
        const columns = extractColumns(returnFields.fields);
        return columns.join(", ");
    }

    return '*'; // Default case
}

function buildInsertSql(
    table: string,
     data: any[],
     returnFields:  NestedField | null | undefined): [string, any[]] {
    if (data.length === 0) {
        return ["", []];
    }

    const columns = Object.keys(data[0]).map(col => `"${col}"`).join(", ");
    const placeholders = "(" + Object.keys(data[0]).map(() => "?").join(", ") + ")";
    const valuesTuple = Array(data.length).fill(placeholders).join(", ");
    const returning = buildReturningClause(returnFields);
    const sql = `INSERT INTO "${table}" (${columns}) VALUES ${valuesTuple} RETURNING ${returning}`; // Always include RETURNING *
    const values: InArgs[] = data.reduce((acc, item) => acc.concat(Object.values(item)), []);

    return [sql, values];
}

function buildUpdateSql(
    table: string,
     pkColumns: { [key: string]: any },
      setArguments: { [key: string]: any },
       incArguments: { [key: string]: any },
       returnFields:  NestedField | null | undefined
       ): [string, any[]] {
    const setClauses: string[] = [];
    const args: any[] = [];

    // Handling _set arguments
    Object.entries(setArguments).forEach(([column, value]) => {
        setClauses.push(`"${column}" = ?`);
        args.push(value);
    });

    // Handling _inc arguments
    Object.entries(incArguments).forEach(([column, incrementValue]) => {
        setClauses.push(`"${column}" = "${column}" + ?`);
        args.push(incrementValue);
    });

    const whereClause = Object.keys(pkColumns).map(column => `"${column}" = ?`).join(" AND ");
    args.push(...Object.values(pkColumns));

    const setClause = setClauses.join(", ");
    const returning = buildReturningClause(returnFields);
    const sql = `UPDATE "${table}" SET ${setClause} WHERE ${whereClause} RETURNING ${returning}`;
    return [sql, args];
}

function buildDeleteSql(
    table: string, 
    pkColumns: { [key: string]: any },
    returnFields:  NestedField | null | undefined): [string, any[]] {
    const whereClause = Object.keys(pkColumns).map(column => `"${column}" = ?`).join(" AND ");
    const args: InArgs[] = Object.values(pkColumns);
    const returning = buildReturningClause(returnFields);
    const sql = `DELETE FROM "${table}" WHERE ${whereClause} RETURNING ${returning}`;
    return [sql, args];
}

export async function do_mutation(configuration: Configuration, state: State, mutation: MutationRequest): Promise<MutationResponse> {
    let procedures: MutationOperation[] = [];
    let operation_results: MutationOperationResults[] = [];
    for (let op of mutation.operations){
        if (op.type !== "procedure"){
            throw new Forbidden("Not implemented yet.", {});
        } else {
            procedures.push(op);
        }
    }
    for (let procedure of procedures){
        if (procedure.type !== "procedure"){
            throw new Forbidden("Not implemented yet.", {});
        }
        if (procedure.name === "sync"){
            const client = state.client;
            await client.sync();
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
                const [sql, values] = buildInsertSql(table, data, procedure.fields);

                if (sql) {
                    try {
                        const results: ResultSet[] = await execute_sql_transaction(state, [{ sql, args: values }]);
                        const insertResult = results[0]; // Assuming batch operation returns an array of ResultSet
                        const returnValue = insertResult.rows.map(row => Object.assign({}, row));
                        operation_results.push({
                            type: "procedure",
                            result: returnValue
                        });
                    } catch (error) {
                        console.error("Error executing insert operation:", error);
                        throw new Conflict("Failed to execute insert operation.", {error: `${error}`});
                    }
                } else {
                    console.log("No SQL statement generated for insert operation.");
                    throw new Forbidden("No data provided for insert operation.", {});
                }
            } else if (procedure.name.startsWith("delete_") && procedure.name.endsWith("_by_pk")) {
                const table: string = procedure.name.slice("delete_".length, -"_by_pk".length);
                const pkColumns = procedure.arguments.pk_columns as { [key: string]: any; };
                const [sql, values] = buildDeleteSql(table, pkColumns, procedure.fields);
                try {
                    const results: ResultSet[] = await execute_sql_transaction(state, [{ sql, args: values }]);
                    const deleteResult = results[0]; // Assuming batch operation returns an array of ResultSet
                    const returnValue = deleteResult.rows.map(row => Object.assign({}, row));
                    operation_results.push({
                        type: "procedure",
                        result: returnValue
                    });
                } catch (error) {
                    console.error("Error executing delete operation:", error);
                    throw new Conflict("Failed to execute delete operation.", {error: `${error}`});
                }
            } else if (procedure.name.startsWith("update_") && procedure.name.endsWith("_by_pk")){
                const table: string = procedure.name.slice("update_".length, -"_by_pk".length);
                const pkColumns = procedure.arguments.pk_columns as { [key: string]: any; };
                const setArguments = procedure.arguments._set || {};
                const incArguments = procedure.arguments._inc || {};
                const [sql, values] = buildUpdateSql(table, pkColumns, setArguments, incArguments, procedure.fields);
            
                try {
                    const results: ResultSet[] = await execute_sql_transaction(state, [{ sql, args: values }]);
                    const updateResult = results[0]; // Assuming batch operation returns an array of ResultSet
                    const returnValue = updateResult.rows.map(row => Object.assign({}, row));
                    operation_results.push({
                        type: "procedure",
                        result: returnValue
                    });
                } catch (error) {
                    console.error("Error executing update operation:", error);
                    throw new Conflict("Failed to execute update operation.");
                }
            } else if (procedure.name.startsWith("update_") && procedure.name.endsWith("_many")){
                const table: string = procedure.name.slice("update_".length, -"_many".length);
                const pkColumnsArray = procedure.arguments.pk_columns_array as { [key: string]: any; }[];
                const setArray = procedure.arguments._set_array as any[] || [];
                const incArray = procedure.arguments._inc_array as any[] || [];
            
                if (pkColumnsArray.length !== setArray.length || pkColumnsArray.length !== incArray.length) {
                    throw new Forbidden("Arrays must be of the same length.");
                }
            
                const statements: InStatement[] = pkColumnsArray.map((pkColumns, index) => {
                    const setArguments = setArray[index] || {};
                    const incArguments = incArray[index] || {};
                    const [sql, args] = buildUpdateSql(table, pkColumns, setArguments, incArguments, procedure.fields);
                    return { sql, args };
                });

                try {
                    const results: ResultSet[] = await execute_sql_transaction(state, statements);
                    const returnValue = results.map(result => result.rows.map(row => Object.assign({}, row))).flat();
                    operation_results.push({
                        type: "procedure",
                        result: returnValue
                    });
                } catch (error) {
                    console.error("Error executing batch update operation:", error);
                    throw new Conflict("Failed to execute batch update operation.", {error: `${error}`});
                }
            } else if (procedure.name.startsWith("delete_") && procedure.name.endsWith("_many")) {
                const table = procedure.name.slice("delete_".length, -"_many".length);
                const pkColumnsArray = procedure.arguments.pk_columns_array as { [key: string]: any; }[];
            
                // Create a batch of delete statements
                const statements: InStatement[] = pkColumnsArray.map(pkColumns => {
                    const [sql, args] = buildDeleteSql(table, pkColumns, procedure.fields);
                    return { sql, args };
                });

                try {
                    const results: ResultSet[] = await execute_sql_transaction(state, statements);
                    const returnValue = results.map(result => result.rows.map(row => Object.assign({}, row))).flat();
                    operation_results.push({
                        type: "procedure",
                        result: returnValue
                    });
                } catch (error) {
                    console.error("Error executing batch delete operation:", error);
                    throw new Conflict("Failed to execute batch delete operation.", {error: `${error}`});
                }
            } else if (procedure.name.startsWith("insert_") && procedure.name.endsWith("_many")){
                const table = procedure.name.slice("insert_".length, -"_many".length);
                const data = procedure.arguments.objects as { [key: string]: any }[]; // Assuming `objects` is the name of the argument containing the records to insert
            
                if (!data || data.length === 0) {
                    throw new Forbidden("No data provided for insert_many operation.", {});
                }
            
                const [sql, values] = buildInsertSql(table, data, procedure.fields);
            
                try {
                    const results: ResultSet[] = await execute_sql_transaction(state, [{ sql, args: values }]);
                    const insertResult = results[0]; // Assuming batch operation returns an array of ResultSet
                    const returnValue = insertResult.rows.map(row => Object.assign({}, row));
            
                    operation_results.push({
                        type: "procedure",
                        result: returnValue
                    });
                } catch (error) {
                    console.error("Error executing insert_many operation:", error);
                    throw new Conflict("Failed to execute insert_many operation.", {error: `${error}`});
                }
            } else {
                console.log("NOT COVERED");
                throw new Forbidden("Not implemented yet.", {});
            }
        }
    }

    return {
        operation_results: operation_results
    };
}