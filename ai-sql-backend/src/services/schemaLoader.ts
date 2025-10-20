import fs from "fs";
import path from "path";
import { DMS_SCHEMA_PATH, ENTITIES_SCHEMA_PATH } from "../config/env";

export type SchemaHints = {
  tables: string[];
  columnsByTable: Record<string, string[]>;
};

function parsePrismaSchema(schema: string): SchemaHints {
  const tables: string[] = [];
  const columnsByTable: Record<string, string[]> = {};

  const modelRegex = /model\s+(\w+)\s+\{([\s\S]*?)\}/g;
  let match: RegExpExecArray | null;
  while ((match = modelRegex.exec(schema))) {
    const table = match[1];
    const body = match[2];
    const columnLines = body
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("@@") && !l.startsWith("//") && !l.startsWith("/*") && !l.startsWith("}") );
    const columns: string[] = [];
    for (const line of columnLines) {
      const name = line.split(/\s+/)[0];
      if (name && /^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
        columns.push(name);
      }
    }
    tables.push(table);
    columnsByTable[table] = columns;
  }

  return { tables, columnsByTable };
}

export function loadSchemas(): { entities: SchemaHints; dms: SchemaHints } {
  // Prefer .txt; if not found, fall back to .ttxt seamlessly
  function readWithFallback(p: string): string {
    const resolved = path.resolve(p);
    if (fs.existsSync(resolved)) return fs.readFileSync(resolved, "utf8");
    if (resolved.endsWith(".txt")) {
      const alt = resolved.replace(/\.txt$/i, ".ttxt");
      if (fs.existsSync(alt)) return fs.readFileSync(alt, "utf8");
    }
    if (resolved.endsWith(".ttxt")) {
      const alt = resolved.replace(/\.ttxt$/i, ".txt");
      if (fs.existsSync(alt)) return fs.readFileSync(alt, "utf8");
    }
    throw new Error(`Schema file not found: ${resolved}`);
  }

  const entitiesRaw = readWithFallback(ENTITIES_SCHEMA_PATH);
  const dmsRaw = readWithFallback(DMS_SCHEMA_PATH);
  return {
    entities: parsePrismaSchema(entitiesRaw),
    dms: parsePrismaSchema(dmsRaw),
  };
}

export function buildSchemaSummary(hints: SchemaHints): string {
  const lines: string[] = [];
  for (const table of hints.tables.slice(0, 200)) {
    const cols = hints.columnsByTable[table]?.slice(0, 50) || [];
    lines.push(`- ${table}: ${cols.join(", ")}`);
  }
  return lines.join("\n");
}
