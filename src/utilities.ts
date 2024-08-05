import { ObjectField, Type } from "@hasura/ndc-sdk-typescript";
import { Client } from "@libsql/client/.";

export type TableIntrospectResult = {
  object_types: Record<string, ObjectField>;
  field_names: string[];
  primary_keys: string[];
  unique_keys: string[];
  nullable_keys: string[];
  field_types: { [k: string]: string };
  foreign_keys: { [k: string]: { table: string; column: string } };
};

// TODO: Add support for functional types.
const determine_type = (dataType: string): Type => {
  switch (dataType) {
    case "DATETIME":
      return { type: "named", name: "String" };
    case "INTEGER":
      return { type: "named", name: "Int" };
    case "REAL":
      return { type: "named", name: "Float" };
    case "TEXT":
      return { type: "named", name: "String" };
    case "BLOB":
      throw new Error("BLOB NOT SUPPORTED!");
    default:
      if (dataType.startsWith("NVARCHAR")) {
        return { type: "named", name: "String" };
      } else if (dataType.startsWith("NUMERIC")) {
        return { type: "named", name: "Float" };
      }
      return { type: "named", name: "String" }; // Unknown types get cast to strings
  }
};

const wrap_nullable = (
  type: Type,
  isNotNull: boolean,
  isPrimaryKey: boolean
): Type => {
  if (isPrimaryKey) {
    return type; // Primary keys should never be nullable
  }
  return isNotNull ? type : { type: "nullable", underlying_type: type };
};

export const introspect_table = async (
  table_name: string,
  client: Client
): Promise<TableIntrospectResult> => {
  const columns_result = await client.execute(
    `PRAGMA table_info(${table_name})`
  );

  let response: TableIntrospectResult = {
    object_types: {},
    field_names: [],
    primary_keys: [],
    unique_keys: [],
    nullable_keys: [],
    field_types: {},
    foreign_keys: {},
  };
  
  for (const column of columns_result.rows) {
    if (typeof column.name !== "string") {
      throw new Error("Column name must be string");
    }

    const determined_type = determine_type(
      (column.type as string).toUpperCase()
    );
    const final_type = wrap_nullable(
      determined_type,
      column.notnull === 1,
      column.pk === 1
    );

    response.field_names.push(column.name);
    if ((column.pk as number) > 0) {
      response.primary_keys.push(column.name);
    }
    if (column.notnull === 0 && column.pk === 0) {
      response.nullable_keys.push(column.name);
    }
    if (determined_type.type === "named") {
      response.field_types[column.name] = determined_type.name;
    }
    response.object_types[column.name] = {
      type: final_type,
    };
  }

  // Introspect for foreign keys:
  const foreign_keys_result = await client.execute(
    `PRAGMA foreign_key_list(${table_name})`
  );
  for (const fk of foreign_keys_result.rows) {
    response.foreign_keys[fk.from as string] = {
      table: fk.table as string,
      column: fk.to as string,
    };
  }

  // Introspect for unique keys:
  const index_list_result = await client.execute(
    `PRAGMA index_list(${table_name})`
  );
  for (const index of index_list_result.rows) {
    if (index.unique) {
      const index_info_result = await client.execute(
        `PRAGMA index_info(${index.name})`
      );
      for (const col of index_info_result.rows) {
        if (!response.unique_keys.includes(col.name as string)) {
          response.unique_keys.push(col.name as string);
        }
      }
    }
  }
  return response;
};
