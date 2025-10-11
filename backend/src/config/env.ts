import dotenv from "dotenv";
dotenv.config();

// Helper function to get required environment variable
function getRequiredEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Required environment variable ${key} is not set`);
    }
    return value;
}

// Helper function to get required numeric environment variable
function getRequiredNumericEnv(key: string): number {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Required environment variable ${key} is not set`);
    }
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
        throw new Error(`Environment variable ${key} must be a valid number`);
    }
    return parsed;
}

// Helper function to get optional environment variable with default
function getOptionalEnv(key: string, defaultValue: string): string {
    return process.env[key] || defaultValue;
}

// Helper function to get optional numeric environment variable with default
function getOptionalNumericEnv(key: string, defaultValue: number): number {
    const value = process.env[key];
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
}

// Required environment variables
const PORT = getRequiredNumericEnv("PORT");
const NODE_ENV = getRequiredEnv("NODE_ENV");
const HEALTH_CHECK_URL = getRequiredEnv("HEALTH_CHECK_URL");

// ✅ MySQL Database (Prisma or mysql2) - Use specific database URLs
const DMS_PROD_DATABASE_URL = getRequiredEnv("DMS_PROD_DATABASE_URL");
const ENTITIES_PROD_DATABASE_URL = getRequiredEnv("ENTITIES_PROD_DATABASE_URL");
const MYSQL_HOST = getRequiredEnv("MYSQL_HOST");
const MYSQL_PORT = getRequiredEnv("MYSQL_PORT");
const MYSQL_USER = getRequiredEnv("MYSQL_USER");
const MYSQL_PASSWORD = getRequiredEnv("MYSQL_PASSWORD");
const MYSQL_DB = getRequiredEnv("MYSQL_DB");

// ✅ Azure OpenAI
const AZURE_OPENAI_KEY = getRequiredEnv("AZURE_OPENAI_KEY");
const AZURE_OPENAI_ENDPOINT = getRequiredEnv("AZURE_OPENAI_ENDPOINT");
const AZURE_OPENAI_DEPLOYMENT = getRequiredEnv("AZURE_OPENAI_DEPLOYMENT");
const AZURE_OPENAI_API_VERSION = getRequiredEnv("AZURE_OPENAI_API_VERSION");
const AI_FOUNDRY_ENDPOINT = getRequiredEnv("AI_FOUNDRY_ENDPOINT");

// ✅ phpMyAdmin
const PHPMYADMIN_URL = getRequiredEnv("PHPMYADMIN_URL");

export {
  PORT,
  NODE_ENV,
  HEALTH_CHECK_URL,
  DMS_PROD_DATABASE_URL,
  ENTITIES_PROD_DATABASE_URL,
  MYSQL_HOST,
  MYSQL_PORT,
  MYSQL_USER,
  MYSQL_PASSWORD,
  MYSQL_DB,
  AZURE_OPENAI_KEY,
  AZURE_OPENAI_ENDPOINT,
  AZURE_OPENAI_DEPLOYMENT,
  AZURE_OPENAI_API_VERSION,
  AI_FOUNDRY_ENDPOINT,
  PHPMYADMIN_URL,
};
