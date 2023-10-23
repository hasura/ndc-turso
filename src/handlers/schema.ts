import { CollectionInfo, SchemaResponse } from "@hasura/ndc-sdk-typescript";
import { Configuration, ObjectFieldDetails } from "..";
import { SCALAR_TYPES } from "../constants";

export function doGetSchema(configuration: Configuration): SchemaResponse {
    const { config } = configuration;
    if (!config) {
        throw new Error('Configuration is missing');
    }
    const { object_fields, object_types, collection_names } = config;
    const collectionInfos: CollectionInfo[] = [];  // Initialize as an empty array
    // const foreignKeyCollections: CollectionInfo[] = [];

    Object.keys(object_types).forEach(cn => {
        if (collection_names.includes(cn)) {
            const fieldDetails: ObjectFieldDetails = object_fields[cn];
            const foreignKeys: any = {};

            for (const [key, fkInfo] of Object.entries(fieldDetails.foreign_keys)) {
                foreignKeys[key] = {
                    column_mapping: { [key]: fkInfo.column },
                    foreign_collection: fkInfo.table
                    // foreign_collection: `${cn}_${fkInfo.table}` // Rework that doesn't work to get around the engine bug
                };

                // Generate a new collection for each foreign key
                // foreignKeyCollections.push({
                //     name: `${cn}_${fkInfo.table}`,
                //     description: null,
                //     arguments: {},
                //     type: fkInfo.table,
                //     deletable: false,
                //     uniqueness_constraints: {},
                //     foreign_keys: {}
                // });
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

    // const allCollections = [...collectionInfos, ...foreignKeyCollections];
    const allCollections = [...collectionInfos];

    const schemaResponse: SchemaResponse = {
        scalar_types: SCALAR_TYPES,
        functions: config.functions,
        procedures: config.procedures,
        object_types: config.object_types,
        collections: allCollections
    };

    return schemaResponse;
}
