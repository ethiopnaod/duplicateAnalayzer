"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXECUTE_SQL_AUTOMATICALLY = exports.DMS_DB_URL = exports.ENTITIES_DB_URL = exports.NODE_ENV = exports.PORT = exports.DMS_SCHEMA_PATH = exports.ENTITIES_SCHEMA_PATH = exports.EMBEDDING_METHOD = exports.USE_LOCAL_EMBEDDINGS = exports.DISABLE_EMBEDDINGS = exports.AZURE_OPENAI_EMBEDDING = exports.AZURE_OPENAI_ENDPOINT = exports.AZURE_OPENAI_DEPLOYMENT = exports.AZURE_OPENAI_API_VERSION = exports.AZURE_OPENAI_KEY = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.AZURE_OPENAI_KEY = process.env.AZURE_OPENAI_KEY || "";
exports.AZURE_OPENAI_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || "2024-08-01-preview";
exports.AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o-mini";
exports.AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT || "";
exports.AZURE_OPENAI_EMBEDDING = process.env.AZURE_OPENAI_EMBEDDING || "text-embedding-3-large";
exports.DISABLE_EMBEDDINGS = (process.env.DISABLE_EMBEDDINGS || "true").toLowerCase() === "true";
// Embedding method configuration
exports.USE_LOCAL_EMBEDDINGS = (process.env.USE_LOCAL_EMBEDDINGS || "true").toLowerCase() === "true";
exports.EMBEDDING_METHOD = process.env.EMBEDDING_METHOD || (exports.USE_LOCAL_EMBEDDINGS ? "local" : "azure");
// Resolve schema defaults to files in ai-sql-backend root directory
exports.ENTITIES_SCHEMA_PATH = process.env.ENTITIES_SCHEMA_PATH || "entities_prod_definition.txt";
exports.DMS_SCHEMA_PATH = process.env.DMS_SCHEMA_PATH || "dms_prod_definition.txt";
exports.PORT = parseInt(process.env.PORT || "5050", 10);
exports.NODE_ENV = process.env.NODE_ENV || "development";
// Database connections (MySQL)
exports.ENTITIES_DB_URL = process.env.ENTITIES_DB_URL || ""; // e.g., mysql://user:pass@host:3306/entities
exports.DMS_DB_URL = process.env.DMS_DB_URL || ""; // e.g., mysql://user:pass@host:3306/dms
// Execution toggle for generated SQL
exports.EXECUTE_SQL_AUTOMATICALLY = (process.env.EXECUTE_SQL_AUTOMATICALLY || "false").toLowerCase() === "true";
