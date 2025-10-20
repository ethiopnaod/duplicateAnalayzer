"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadSchemas = loadSchemas;
exports.buildSchemaSummary = buildSchemaSummary;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const env_1 = require("../config/env");
function parsePrismaSchema(schema) {
    const tables = [];
    const columnsByTable = {};
    const modelRegex = /model\s+(\w+)\s+\{([\s\S]*?)\}/g;
    let match;
    while ((match = modelRegex.exec(schema))) {
        const table = match[1];
        const body = match[2];
        const columnLines = body
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l && !l.startsWith("@@") && !l.startsWith("//") && !l.startsWith("/*") && !l.startsWith("}"));
        const columns = [];
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
function loadSchemas() {
    // Prefer .txt; if not found, fall back to .ttxt seamlessly
    function readWithFallback(p) {
        const resolved = path_1.default.resolve(p);
        if (fs_1.default.existsSync(resolved))
            return fs_1.default.readFileSync(resolved, "utf8");
        if (resolved.endsWith(".txt")) {
            const alt = resolved.replace(/\.txt$/i, ".ttxt");
            if (fs_1.default.existsSync(alt))
                return fs_1.default.readFileSync(alt, "utf8");
        }
        if (resolved.endsWith(".ttxt")) {
            const alt = resolved.replace(/\.ttxt$/i, ".txt");
            if (fs_1.default.existsSync(alt))
                return fs_1.default.readFileSync(alt, "utf8");
        }
        throw new Error(`Schema file not found: ${resolved}`);
    }
    const entitiesRaw = readWithFallback(env_1.ENTITIES_SCHEMA_PATH);
    const dmsRaw = readWithFallback(env_1.DMS_SCHEMA_PATH);
    return {
        entities: parsePrismaSchema(entitiesRaw),
        dms: parsePrismaSchema(dmsRaw),
    };
}
function buildSchemaSummary(hints) {
    const lines = [];
    for (const table of hints.tables.slice(0, 200)) {
        const cols = hints.columnsByTable[table]?.slice(0, 50) || [];
        lines.push(`- ${table}: ${cols.join(", ")}`);
    }
    return lines.join("\n");
}
