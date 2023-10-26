import { CollectionInfo, SchemaResponse } from "@hasura/ndc-sdk-typescript";
import { Configuration, ObjectFieldDetails } from "..";
import { SCALAR_TYPES } from "../constants";

// TODO: Determine the proper way to generate the aggregate collections.

export function doGetSchema(configuration: Configuration): SchemaResponse {
    const { config } = configuration;
    if (!config) {
        throw new Error('Configuration is missing');
    }
    const { object_fields, object_types, collection_names } = config;
    const collectionInfos: CollectionInfo[] = [];  // Initialize as an empty array

    Object.keys(object_types).forEach(cn => {
        if (collection_names.includes(cn)) {
            const fieldDetails: ObjectFieldDetails = object_fields[cn];
            const foreignKeys: any = {};

            for (const [key, fkInfo] of Object.entries(fieldDetails.foreign_keys)) {
                foreignKeys[key] = {
                    column_mapping: { [key]: fkInfo.column },
                    foreign_collection: fkInfo.table
                };
            }

            collectionInfos.push({
                name: cn,
                description: null,
                arguments: {},
                type: cn,
                deletable: false,
                uniqueness_constraints: {
                    [`${cn.charAt(0).toUpperCase() + cn.slice(1)}ByID`]: {
                        unique_columns: fieldDetails.primary_keys
                    }
                },
                foreign_keys: foreignKeys
            });

        }
    });

    const schemaResponse: SchemaResponse = {
        scalar_types: SCALAR_TYPES,
        functions: config.functions,
        procedures: config.procedures,
        object_types: config.object_types,
        collections: collectionInfos
    };

    return schemaResponse;
}
