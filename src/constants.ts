import { CapabilitiesResponse, ObjectField, ObjectType, ScalarType } from "@hasura/ndc-sdk-typescript";
export const MAX_32_INT: number = 2147483647;
export const CAPABILITIES_RESPONSE: CapabilitiesResponse = {
  versions: "^0.1.0",
  capabilities: {
    query: {
      foreach: {}
    },
    relationships: {}
  },
};
export const SCALAR_TYPES: { [key: string]: ScalarType } = {
    Int: {
      aggregate_functions: {
        // sum: {
        //   result_type: {
        //     type: "named",
        //     name: "Int"
        //   }
        // }
      },
      comparison_operators: {
        _gt: {
          argument_type: {
            type: "named",
            name: "Int",
          },
        },
        _lt: {
          argument_type: {
            type: "named",
            name: "Int",
          },
        },
        _gte: {
          argument_type: {
            type: "named",
            name: "Int",
          },
        },
        _lte: {
          argument_type: {
            type: "named",
            name: "Int",
          },
        },
        _neq: {
          argument_type: {
            type: "named",
            name: "Int",
          },
        },
      },
      update_operators: {},
    },
    Float: {
      aggregate_functions: {
        // sum: {
        //   result_type: {
        //     type: "named",
        //     name: "Float"
        //   }
        // }
      },
      comparison_operators: {
        _gt: {
          argument_type: {
            type: "named",
            name: "Float",
          },
        },
        _lt: {
          argument_type: {
            type: "named",
            name: "Float",
          },
        },
        _gte: {
          argument_type: {
            type: "named",
            name: "Float",
          },
        },
        _lte: {
          argument_type: {
            type: "named",
            name: "Float",
          },
        },
        _neq: {
          argument_type: {
            type: "named",
            name: "Float",
          },
        },
      },
      update_operators: {},
    },
    String: {
      aggregate_functions: {},
      comparison_operators: {
        _like: {
          argument_type: {
            type: "named",
            name: "String",
          },
        },
        _glob: {
          argument_type: {
            type: "named",
            name: "String",
          },
        },
        _gt: {
          argument_type: {
            type: "named",
            name: "String",
          },
        },
        _lt: {
          argument_type: {
            type: "named",
            name: "String",
          },
        },
        _gte: {
          argument_type: {
            type: "named",
            name: "String",
          },
        },
        _lte: {
          argument_type: {
            type: "named",
            name: "String",
          },
        },
        _neq: {
          argument_type: {
            type: "named",
            name: "String",
          },
        },
      },
      update_operators: {},
    },
    // Geo Type? https://qdrant.tech/documentation/concepts/payload/
  };
  
export const BASE_FIELDS: Record<string, ObjectField> = {};
export const BASE_TYPES: { [k: string]: ObjectType } = {};
