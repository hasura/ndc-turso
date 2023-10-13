import { Configuration, ObjectFieldDetails } from ".."; // Adjust the path as needed
import { getTursoClient } from "../turso"; // Assuming you have a turso client module
import { introspectTable } from "../utilities";
import { BASE_FIELDS, BASE_TYPES } from "../constants";

export async function doUpdateConfiguration(
  configuration: Configuration
): Promise<Configuration> {
  const client = getTursoClient({
    url: configuration.credentials.url,
    syncUrl: configuration.credentials.syncUrl,
    authToken: configuration.credentials.authToken,
  });

  const tablesResult = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table'"
  );
  const tableNames = tablesResult.rows.map((row) => String(row.name));
  const tableNamesPlural = tableNames.map((name) => name + "s");

  if (!configuration.config) {
    configuration.config = {
      collection_names: tableNamesPlural,
      object_types: { ...BASE_TYPES },
      object_fields: {},
      functions: [],
      procedures: [],
    };

    const objectFields: Record<string, ObjectFieldDetails> = {};

    for (const tableName of tableNames) {
      const fieldDict = await introspectTable(tableName, client);
      configuration.config.object_types[tableName] = {
        description: null,
        fields: {
          ...fieldDict.object_types,
          ...BASE_FIELDS,
        },
      };
      objectFields[tableName] = {
        field_names: fieldDict.field_names,
        field_types: fieldDict.field_types,
        primary_keys: fieldDict.primary_keys,
        unique_keys: fieldDict.unique_keys,
        nullable_keys: fieldDict.nullable_keys,
        foreign_keys: fieldDict.foreign_keys,
      };
    }

    configuration.config.object_fields = objectFields;
  }

  return configuration;
}
