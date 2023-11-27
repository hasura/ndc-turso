import { CollectionInfo, FunctionInfo, ProcedureInfo, SchemaResponse } from "@hasura/ndc-sdk-typescript";
import { Configuration, ObjectFieldDetails } from "..";
import { SCALAR_TYPES } from "../constants";

export function do_get_schema(configuration: Configuration): SchemaResponse {
    const { config } = configuration;
    if (!config) {
        throw new Error('Configuration is missing');
    }
    const { object_fields, object_types, collection_names } = config;
    const collection_infos: CollectionInfo[] = [];  // Initialize as an empty array

    Object.keys(object_types).forEach(cn => {
        if (collection_names.includes(cn)) {
            const field_details: ObjectFieldDetails = object_fields[cn];
            const foreign_keys: any = {};
            for (const [key, fkInfo] of Object.entries(field_details.foreign_keys)) {
                foreign_keys[key] = {
                    column_mapping: { [key]: fkInfo.column },
                    foreign_collection: fkInfo.table
                };
            }
            collection_infos.push({
                name: cn,
                description: null,
                arguments: {},
                type: cn,
                uniqueness_constraints: {
                    [`${cn.charAt(0).toUpperCase() + cn.slice(1)}ByID`]: {
                        unique_columns: field_details.primary_keys
                    }
                },
                foreign_keys: foreign_keys
            });

        }
    });
    const procedures: ProcedureInfo[] = [
        {
            arguments: {},
            name: "sync",
            description: "Sync the Local Database file with the Remote Primary Database",
            result_type: {
                type: "named",
                name: "Int"
            }
        }
    ];
    const functions: FunctionInfo[] = [];
    const schema_response: SchemaResponse = {
        scalar_types: SCALAR_TYPES,
        functions: functions,
        procedures: procedures,
        object_types: config.object_types,
        collections: collection_infos
    };
    return schema_response;
}
