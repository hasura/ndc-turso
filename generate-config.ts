import { get_turso_client } from "./src/turso"; // Assuming you have a turso client module
import * as fs from "fs";
import { promisify } from "util";
import { introspect_table } from "./src/utilities";
import { BASE_FIELDS, BASE_TYPES } from "./src/constants";
import { Configuration, ObjectFieldDetails } from "./src";
const writeFile = promisify(fs.writeFile);

const DEFAULT_DATA_FILE = "file:chinook.sqlite"; // Adjust this to your default SQLite file path
const DEFAULT_OUTPUT_FILENAME = "configuration.json";
const args = process.argv.slice(2);
let data_file = DEFAULT_DATA_FILE;
let output_file_name = DEFAULT_OUTPUT_FILENAME;

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case "--data-file":
      data_file = args[i + 1];
      i++;
      break;
    case "--output":
      output_file_name = args[i + 1];
      i++;
      break;
    default:
      console.error(`Unknown argument: ${args[i]}`);
      process.exit(1);
  }
}

let client = get_turso_client({ url: data_file });

async function main() {
  const tables_result = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name <> 'sqlite_sequence' AND name <> 'sqlite_stat1'"
  );
  const table_names = tables_result.rows.map((row) => String(row.name));
  let object_types: Record<string, any> = {
    ...BASE_TYPES,
  };

  const object_fields: Record<string, ObjectFieldDetails> = {}; 
  for (const table_name of table_names) {
    const field_dict = await introspect_table(table_name, client);
    object_types[table_name] = {
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

  console.log(`Writing object_types and tables to ${output_file_name}`);
  const res: Configuration = {
    credentials: {
        url: data_file
    },
    config: {
      collection_names: table_names,
      object_fields: object_fields,
      object_types: object_types
    },
  };

  await writeFile(output_file_name, JSON.stringify(res));
}

main();
