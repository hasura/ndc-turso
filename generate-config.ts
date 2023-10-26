import { getTursoClient } from "./src/turso"; // Assuming you have a turso client module
import * as fs from "fs";
import { promisify } from "util";
import { introspectTable } from "./src/utilities";
import { BASE_FIELDS, BASE_TYPES } from "./src/constants";
import { Configuration, ObjectFieldDetails } from "./src";
const writeFile = promisify(fs.writeFile);

const DEFAULT_DATA_FILE = "file:chinook.sqlite"; // Adjust this to your default SQLite file path
const DEFAULT_OUTPUT_FILENAME = "configuration.json";
const args = process.argv.slice(2);
let dataFile = DEFAULT_DATA_FILE;
let outputFileName = DEFAULT_OUTPUT_FILENAME;

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case "--data-file":
      dataFile = args[i + 1];
      i++;
      break;
    case "--output":
      outputFileName = args[i + 1];
      i++;
      break;
    default:
      console.error(`Unknown argument: ${args[i]}`);
      process.exit(1);
  }
}

let client = getTursoClient({ url: dataFile });

async function main() {
  const tablesResult = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table'"
  );
  const tableNames = tablesResult.rows.map((row) => String(row.name));
  let objectTypes: Record<string, any> = {
    ...BASE_TYPES,
  };

  const objectFields: Record<string, ObjectFieldDetails> = {}; 
  for (const tableName of tableNames) {
    const fieldDict = await introspectTable(tableName, client);
    objectTypes[tableName] = {
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

  console.log(`Writing object_types and tables to ${outputFileName}`);
  const res: Configuration = {
    credentials: {
        url: dataFile
    },
    config: {
      collection_names: tableNames,
      object_fields: objectFields,
      object_types: objectTypes,
      functions: [],
      procedures: [],
    },
  };

  await writeFile(outputFileName, JSON.stringify(res));
}

main();
