import { get_turso_client } from "./src/turso"; // Assuming you have a turso client module
import * as fs from "fs";
import { promisify } from "util";
import { introspect_table } from "./src/utilities";
import { BASE_FIELDS, BASE_TYPES } from "./src/constants";
import { Configuration, ObjectFieldDetails } from "./src";
const writeFile = promisify(fs.writeFile);

const url = process.env["TURSO_URL"] as string;
const syncUrl = process.env["TURSO_SYNC_URL"] as string | undefined;
const authToken = process.env["TURSO_AUTH_TOKEN"] as string | undefined;
let client = get_turso_client({ url: url,  syncUrl: syncUrl, authToken: authToken});

async function main() {
  const tables_result = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name <> 'sqlite_sequence' AND name <> 'sqlite_stat1'  AND name <> 'libsql_wasm_func_table'"
  );
  const table_names = tables_result.rows.map((row) => String(row.name));
  let object_types: Record<string, any> = {
    ...BASE_TYPES,
  };

  const object_fields: Record<string, ObjectFieldDetails> = {}; 
  for (const table_name of table_names) {
    const field_dict = await introspect_table(table_name, client);
    object_types[table_name] = {
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
  const res: Configuration = {
    config: {
      collection_names: table_names,
      object_fields: object_fields,
      object_types: object_types
    },
  };

  await writeFile(`/etc/connector/config.json`, JSON.stringify(res));
}

main();
