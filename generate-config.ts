import { get_turso_client } from "./src/turso"; // Assuming you have a turso client module
import * as fs from "fs";
import { promisify } from "util";
import { introspect_table } from "./src/utilities";
import { BASE_FIELDS, BASE_TYPES } from "./src/constants";
import { Configuration, ObjectFieldDetails } from "./src";
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
let HASURA_CONFIGURATION_DIRECTORY = process.env["HASURA_CONFIGURATION_DIRECTORY"] as string | undefined;
if (HASURA_CONFIGURATION_DIRECTORY === undefined || HASURA_CONFIGURATION_DIRECTORY.length === 0){
    HASURA_CONFIGURATION_DIRECTORY = ".";
}
const TURSO_URL = process.env["TURSO_URL"] as string;
let TURSO_SYNC_URL = process.env["TURSO_SYNC_URL"] as string | undefined;
if (TURSO_SYNC_URL?.length === 0){
  TURSO_SYNC_URL = undefined;
}
let TURSO_AUTH_TOKEN = process.env["TURSO_AUTH_TOKEN"] as string | undefined;
if (TURSO_AUTH_TOKEN?.length === 0){
  TURSO_AUTH_TOKEN = undefined;
}
let client = get_turso_client({ url: TURSO_URL,  syncUrl: TURSO_SYNC_URL, authToken: TURSO_AUTH_TOKEN});

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
  const jsonString = JSON.stringify(res, null, 4);
  let filePath = `${HASURA_CONFIGURATION_DIRECTORY}/config.json`;
  try {
      const existingData = await readFile(filePath, 'utf8');
      if (existingData !== jsonString) {
          await writeFile(filePath, jsonString);
          console.log('File updated.');
      } else {
          console.log('No changes detected. File not updated.');
      }
  } catch (error) {
      await writeFile(filePath, jsonString);
      console.log('New file written.');
  }
}

main();
