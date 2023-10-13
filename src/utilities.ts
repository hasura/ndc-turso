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

const determineType = (dataType: string): Type => {
  switch (dataType) {
    case "INTEGER":
      return { type: "named", name: "Int" };
    case "REAL":
      return { type: "named", name: "Float" };
    case "TEXT":
      return { type: "named", name: "String" };
    case "BLOB":
      throw new Error("BLOB NOT SUPPORTED!");
    default:
      throw new Error("NOT IMPLEMENTED");
  }
};

const wrapNullable = (
  type: Type,
  isNotNull: boolean,
  isPrimaryKey: boolean
): Type => {
  if (isPrimaryKey) {
    return type; // Primary keys should never be nullable
  }
  return isNotNull ? type : { type: "nullable", underlying_type: type };
};

export const introspectTable = async (
  tableName: string,
  client: Client
): Promise<TableIntrospectResult> => {
  const columnsResult = await client.execute(`PRAGMA table_info(${tableName})`);

  let response: TableIntrospectResult = {
    object_types: {},
    field_names: [],
    primary_keys: [],
    unique_keys: [],
    nullable_keys: [],
    field_types: {},
    foreign_keys: {},
  };

  for (const column of columnsResult.rows) {
    if (typeof column.name !== "string") {
      throw new Error("Column name must be string");
    }

    const determinedType = determineType((column.type as string).toUpperCase());
    const finalType = wrapNullable(
      determinedType,
      column.notnull === 1,
      column.pk === 1
    );

    response.field_names.push(column.name);
    if (column.pk === 1) {
      response.primary_keys.push(column.name);
    }
    if (column.notnull === 0 && column.pk === 0) {
      response.nullable_keys.push(column.name);
    }
    response.field_types[column.name] = column.type as string;
    response.object_types[column.name] = {
      description: null,
      type: finalType,
    };
  }

  // Introspect for foreign keys:
  const foreignKeysResult = await client.execute(
    `PRAGMA foreign_key_list(${tableName})`
  );
  for (const fk of foreignKeysResult.rows) {
    response.foreign_keys[fk.from as string] = {
      table: fk.table as string,
      column: fk.to as string,
    };
  }

  // Introspect for unique keys:
  const indexListResult = await client.execute(
    `PRAGMA index_list(${tableName})`
  );
  for (const index of indexListResult.rows) {
    if (index.unique) {
      const indexInfoResult = await client.execute(
        `PRAGMA index_info(${index.name})`
      );
      for (const col of indexInfoResult.rows) {
        if (!response.unique_keys.includes(col.name as string)) {
          response.unique_keys.push(col.name as string);
        }
      }
    }
  }

  return response;
};
