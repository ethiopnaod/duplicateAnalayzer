import dotenv from "dotenv";

dotenv.config();

export const AZURE_OPENAI_KEY = process.env.AZURE_OPENAI_KEY || "";
export const AZURE_OPENAI_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || "2024-08-01-preview";
export const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o-mini";
export const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT || "";
export const AZURE_OPENAI_EMBEDDING = process.env.AZURE_OPENAI_EMBEDDING || "text-embedding-3-large";
export const DISABLE_EMBEDDINGS = (process.env.DISABLE_EMBEDDINGS || "true").toLowerCase() === "true";

// Embedding method configuration
export const USE_LOCAL_EMBEDDINGS = (process.env.USE_LOCAL_EMBEDDINGS || "true").toLowerCase() === "true";
export const EMBEDDING_METHOD = process.env.EMBEDDING_METHOD || (USE_LOCAL_EMBEDDINGS ? "local" : "azure");

// Resolve schema defaults to files in ai-sql-backend root directory
export const ENTITIES_SCHEMA_PATH = process.env.ENTITIES_SCHEMA_PATH || "entities_prod_definition.txt";
export const DMS_SCHEMA_PATH = process.env.DMS_SCHEMA_PATH || "dms_prod_definition.txt";

export const PORT = parseInt(process.env.PORT || "5050", 10);
export const NODE_ENV = process.env.NODE_ENV || "development";

// Database connections (MySQL)
export const ENTITIES_DB_URL = process.env.ENTITIES_DB_URL || ""; // e.g., mysql://user:pass@host:3306/entities
export const DMS_DB_URL = process.env.DMS_DB_URL || ""; // e.g., mysql://user:pass@host:3306/dms

// Execution toggle for generated SQL
export const EXECUTE_SQL_AUTOMATICALLY = (process.env.EXECUTE_SQL_AUTOMATICALLY || "false").toLowerCase() === "true";