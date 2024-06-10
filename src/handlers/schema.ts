import { CollectionInfo, FunctionInfo, ObjectField, ObjectType, ProcedureInfo, SchemaResponse } from "@hasura/ndc-sdk-typescript";
import { Configuration, ObjectFieldDetails } from "..";
import { SCALAR_TYPES } from "../constants";


function is_numeric_type(type_name: string): boolean {
    const numeric_types: string[] = ['Int', 'Float', 'Decimal']; // Add more types as per your schema
    return numeric_types.includes(type_name);
}

function get_field_operators(field_type: string): Record<string, string> {
    if (field_type === 'Int' || field_type === 'Float') {
        return {
            "_eq": field_type,
            "_neq": field_type,
            "_gt": field_type,
            "_lt": field_type,
            "_gte": field_type,
            "_lte": field_type,
            "_is_null": "Boolean"
        };
    } else if (field_type === 'String') {
        return {
            "_eq": field_type,
            "_neq": field_type,
            "_like": field_type,
            "_is_null": "Boolean"
        };
    }
    return {};
}

function get_nested_where(cn: string, new_object_fields: { [fieldName: string]: ObjectField }, nested: number = 1): ObjectType {
    if (nested === 0) {
        return {
            description: `Where for ${cn}`,
            fields: { ...new_object_fields }
        };
    }
    return {
        description: `Where for ${cn}`,
        fields: {
            ...new_object_fields,
            "_not": {
                type: {
                    type: "nullable",
                    underlying_type: { type: "named", name: `list_${cn}_bool_exp${'_nested'.repeat(nested)}` }
                }
            },
            "_or": {
                type: {
                    type: "nullable",
                    underlying_type: { type: "array", element_type: { type: "named", name: `list_${cn}_bool_exp${'_nested'.repeat(nested)}` } }
                }
            },
            "_and": {
                type: {
                    type: "nullable",
                    underlying_type: { type: "array", element_type: { type: "named", name: `list_${cn}_bool_exp${'_nested'.repeat(nested)}` } }
                }
            }
        }
    };
}

export function do_get_schema(configuration: Configuration): SchemaResponse {
    const { config } = configuration;
    if (!config) {
        throw new Error('Configuration is missing');
    }
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

            const new_object_fields: { [fieldName: string]: ObjectField } = {};
            const insert_object_fields: { [fieldName: string]: ObjectField } = {};

            field_details.field_names.forEach(fieldName => {
                const field_type = field_details.field_types[fieldName];
                const operators = get_field_operators(field_type);
                const field_input_type_name = `${field_type}_comparison_exp`;

                if (!object_types[field_input_type_name]) {
                    object_types[field_input_type_name] = {
                        description: `Input type for filtering on field '${fieldName}'`,
                        fields: Object.fromEntries(Object.entries(operators).map(([op, operator_type]) => [
                            op, { type: { type: "nullable", underlying_type: { type: "named", name: operator_type } } }
                        ]))
                    };
                }

                new_object_fields[fieldName] = {
                    type: {
                        type: "nullable",
                        underlying_type: { type: "named", name: field_input_type_name }
                    }
                };

                const isNullable = field_details.nullable_keys.includes(fieldName);
                if (isNullable) {
                    insert_object_fields[fieldName] = {
                        type: {
                            type: "nullable",
                            underlying_type: {
                                type: "named",
                                name: field_details.field_types[fieldName]
                            }
                        }
                    };
                } else {
                    insert_object_fields[fieldName] = {
                        type: {
                            type: "named",
                            name: field_details.field_types[fieldName]
                        }
                    };
                }
            });

            object_types[`${cn}_InsertType`] = {
                description: `Insert type for ${cn}`,
                fields: insert_object_fields,
            };

            // object_types[`list_${cn}_bool_exp_nested_nested_nested`] = get_nested_where(cn, new_object_fields, 0);
            // object_types[`list_${cn}_bool_exp_nested_nested`] = get_nested_where(cn, new_object_fields, 3);
            // object_types[`list_${cn}_bool_exp_nested`] = get_nested_where(cn, new_object_fields, 2);
            // object_types[`list_${cn}_bool_exp`] = get_nested_where(cn, new_object_fields, 1);

            // const listProcedure: ProcedureInfo = {
            //     name: `list_${cn}`,
            //     description: `List records from the ${cn} collection.`,
            //     arguments: {
            //         "limit": {
            //             type: {
            //                 type: "nullable",
            //                 underlying_type: { type: "named", name: "Int" }
            //             }
            //         },
            //         "offset": {
            //             type: {
            //                 type: "nullable",
            //                 underlying_type: { type: "named", name: "Int" }
            //             }
            //         },
            //         "where": {
            //             type: {
            //                 type: "nullable",
            //                 underlying_type: { type: "named", name: `list_${cn}_bool_exp` }
            //             }
            //         }
            //     },
            //     result_type: {
            //         type: "array",
            //         element_type: { type: "named", name: `${cn}_InsertType` }
            //     }
            // };
            // procedures.push(listProcedure);

            const insertOneProcedure: ProcedureInfo = {
                name: `insert_${cn}_one`,
                description: `Insert a single record into the ${cn} collection.`,
                arguments: {
                    object: {
                        description: `The record to insert into the ${cn}`,
                        type: { type: "named", name: `${cn}_InsertType` }
                    }
                },
                result_type: {type: "array", element_type: {
                    type: "named",
                    name: `${cn}_InsertType`
                }}
            };
            procedures.push(insertOneProcedure);

            if (field_details.primary_keys.length > 0){
                const pkColumnsType: ObjectType = {
                    description: `Primary key columns for ${cn}`,
                    fields: Object.fromEntries(field_details.primary_keys.map(pk => [
                        pk, { type: { type: "named", name: field_details.field_types[pk] }}
                    ]))
                };
                const setType: ObjectType = {
                    description: `Fields to set for ${cn}`,
                    fields: Object.fromEntries(field_details.field_names.map(field_name => [
                        field_name, {
                            type: {
                                type: "nullable",
                                underlying_type: { type: "named", name: field_details.field_types[field_name] }
                            }
                        }
                    ]))
                };
                const incType: ObjectType = {
                    description: `Numeric fields to increment for ${cn}`,
                    fields: Object.fromEntries(field_details.field_names.filter(field_name =>
                        is_numeric_type(field_details.field_types[field_name])).map(field_name => [
                        field_name, {
                            type: {
                                type: "nullable",
                                underlying_type: { type: "named", name: field_details.field_types[field_name] }
                            }
                        }
                    ]))
                };
                // Add these new object types to object_types
                object_types[`${cn}_PKColumnsType`] = pkColumnsType;
                object_types[`${cn}_SetType`] = setType;
                object_types[`${cn}_IncType`] = incType;
                // Define the update_by_pk procedure using named types
                const updateByPkProcedure: ProcedureInfo = {
                    name: `update_${cn}_by_pk`,
                    description: `Update a single record in the ${cn} collection by primary key.`,
                    arguments: {
                        "pk_columns": {
                            description: `The primary key columns of the record to update in the ${cn}`,
                            type: { type: "named", name: `${cn}_PKColumnsType` }
                        },
                        "_set": {
                            description: `The fields to set for the ${cn}`,
                            type: { type: "nullable", underlying_type: { type: "named", name: `${cn}_SetType` }}
                        },
                        "_inc": {
                            description: `The numeric fields to increment for the ${cn}`,
                            type: { type: "nullable", underlying_type: { type: "named", name: `${cn}_IncType` }}
                        }
                    },
                    result_type: {type: "array", element_type: {
                        type: "named",
                        name: `${cn}_InsertType`
                    }}
                };
                procedures.push(updateByPkProcedure);
                // Define the delete_by_pk procedure
                const deleteByPkProcedure: ProcedureInfo = {
                    name: `delete_${cn}_by_pk`,
                    description: `Delete a single record from the ${cn} collection by primary key.`,
                    arguments: {
                        "pk_columns": {
                            description: `The primary key columns of the record to delete in the ${cn}`,
                            type: { type: "named", name: `${cn}_PKColumnsType` }
                        }
                    },
                    result_type: {type: "array", element_type: {
                        type: "named",
                        name: `${cn}_InsertType`
                    }}
                };
                procedures.push(deleteByPkProcedure);

                const updateManyProcedure: ProcedureInfo = {
                    name: `update_${cn}_many`,
                    description: `Update multiple records in the ${cn} collection, with separate arrays for PKs, _set, and _inc.`,
                    arguments: {
                        "pk_columns_array": {
                            description: `An array of primary key structures for the records to update in the ${cn}`,
                            type: { type: "array", element_type: { type: "named", name: `${cn}_PKColumnsType` }}
                        },
                        "_set_array": {
                            description: `An array of _set objects for updating the ${cn}`,
                            type: { type: "array", element_type: { type: "named", name: `${cn}_SetType` }}
                        },
                        "_inc_array": {
                            description: `An array of _inc objects for incrementing fields in the ${cn}`,
                            type: { type: "array", element_type: { type: "named", name: `${cn}_IncType` }}
                        }
                    },
                    result_type: {type: "array", element_type: {
                        type: "named",
                        name: `${cn}_InsertType`
                    }}
                };
                procedures.push(updateManyProcedure);

                const deleteManyProcedure: ProcedureInfo = {
                    name: `delete_${cn}_many`,
                    description: `Delete multiple records from the ${cn} collection based on primary key conditions.`,
                    arguments: {
                        "pk_columns_array": {
                            description: `An array of primary key structures for the records to delete in the ${cn}. Each item in the array represents a condition that identifies one or more records to be deleted.`,
                            type: { type: "array", element_type: { type: "named", name: `${cn}_PKColumnsType` }}
                        }
                    },
                    result_type: {
                        type: "array", 
                        element_type: {
                            type: "named",
                            name: `${cn}_InsertType` // Note: You might want to change this to a more appropriate return type for deletions, such as a count of deleted records or a simple success message.
                        }
                    }
                };
                procedures.push(deleteManyProcedure);

                const insertManyProcedure: ProcedureInfo = {
                    name: `insert_${cn}_many`,
                    description: `Insert multiple records into the ${cn} collection.`,
                    arguments: {
                        objects: {
                            description: `The records to insert into the ${cn}`,
                            type: { 
                                type: "array", 
                                element_type: { 
                                    type: "named", 
                                    name: `${cn}_InsertType`
                                } 
                            }
                        }
                    },
                    result_type: { 
                        type: "array", 
                        element_type: { 
                            type: "named", 
                            name: `${cn}_InsertType`
                        } 
                    }
                };
                procedures.push(insertManyProcedure);
            }
        }
    });

    

    const functions: FunctionInfo[] = [];
    const schema_response: SchemaResponse = {
        scalar_types: SCALAR_TYPES,
        functions: functions,
        procedures: procedures,
        object_types: object_types,
        collections: collection_infos
    };
    return schema_response;
}
