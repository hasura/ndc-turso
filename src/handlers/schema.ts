import { CollectionInfo, SchemaResponse } from "@hasura/ndc-sdk-typescript";
import { Configuration, ObjectFieldDetails } from "..";
import { SCALAR_TYPES } from "../constants";

export function doGetSchema(configuration: Configuration): SchemaResponse {
    const { config } = configuration;
    if (!config) {
        throw new Error('Configuration is missing');
    }
    const { object_fields, object_types, collection_names } = config;
    const collectionInfos = Object.keys(object_types).map(cn => {
        if (collection_names.includes(cn + 's')) {
            const fieldDetails: ObjectFieldDetails = object_fields[cn];
            const foreignKeys: any = {};

            for (const [key, fkInfo] of Object.entries(fieldDetails.foreign_keys)) {
                foreignKeys[key] = {
                    column_mapping: { [key]: fkInfo.column },
                    foreign_collection: fkInfo.table + 's'
                };
            }
            return {
                name: cn + 's',
                description: null,  // This can be replaced with object_types[cn].description if descriptions are available
                arguments: {},  // Blank object for args as per requirement
                type: cn,
                deletable: false,  // Collections are not deletable by default in this function
                uniqueness_constraints: {
                    [`${cn.charAt(0).toUpperCase() + cn.slice(1)}ByID`]: {
                        unique_columns: fieldDetails.primary_keys  // Using primary_keys from the config
                    }
                },
                foreign_keys: foreignKeys  // Using processed foreign keys from the config
            };
        }
        return null;
    }).filter(ci => ci !== null) as CollectionInfo[];  // Filter out null values
    const schemaResponse: SchemaResponse = {
        scalar_types: SCALAR_TYPES,
        functions: config.functions,
        procedures: config.procedures,
        object_types: config.object_types,
        collections: collectionInfos
    };

    return schemaResponse;
}
