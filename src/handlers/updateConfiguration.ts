import { RawConfiguration, ObjectFieldDetails } from ".."; // Adjust the path as needed
import { get_turso_client } from "../turso"; // Assuming you have a turso client module
import { introspect_table } from "../utilities";
import { BASE_FIELDS, BASE_TYPES } from "../constants";

export async function do_update_configuration(
  configuration: RawConfiguration
): Promise<RawConfiguration> {
  const client = get_turso_client({
    url: configuration.credentials.url,
    syncUrl: configuration.credentials.syncUrl,
    authToken: configuration.credentials.authToken,
  });

  const tables_result = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name <> 'sqlite_sequence' AND name <> 'sqlite_stat1' AND name <> 'libsql_wasm_func_table'"
  );
  const table_names = tables_result.rows.map((row) => String(row.name));
  console.log(table_names);

  if (!configuration.config) {
    configuration.config = {
      collection_names: table_names,
      object_types: { ...BASE_TYPES },
      object_fields: {}
    };

    const object_fields: Record<string, ObjectFieldDetails> = {};

    for (const table_name of table_names) {
      const field_dict = await introspect_table(table_name, client);
      configuration.config.object_types[table_name] = {
        description: null,
        fields: {
          ...field_dict.object_types,
          ...BASE_FIELDS,
        },
      };
      object_fields[table_name] = {
        field_names: field_dict.field_names,
        field_types: field_dict.field_types,
        primary_keys: field_dict.primary_keys,
        unique_keys: field_dict.unique_keys,
        nullable_keys: field_dict.nullable_keys,
        foreign_keys: field_dict.foreign_keys,
      };
    }

    configuration.config.object_fields = object_fields;
  }
  client.close(); // Ensure the client is closed.
  return configuration;
}
