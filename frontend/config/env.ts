// Helper function to get required environment variable
function getRequiredEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Required environment variable ${key} is not set`);
    }
    return value;
}

// Helper function to get environment variable with fallback
function getEnvWithFallback(key: string, fallbackKey: string): string {
    return process.env[key] || process.env[fallbackKey] || '';
}

// Helper function to get optional environment variable with default
function getOptionalEnv(key: string, defaultValue: string): string {
    return process.env[key] || defaultValue;
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

// Helper function to get optional numeric environment variable with default
function getOptionalNumericEnv(key: string, defaultValue: number): number {
    const value = process.env[key];
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
}

// Server-side only environment variables (not accessible from client)
export const SERVER_ENV = {
    // Required server environment variables
    // Use APP_ prefix to avoid system environment variable conflicts
    USERNAME: getEnvWithFallback("APP_USERNAME", "USERNAME") || "admin#5515",
    PASSWORD: getEnvWithFallback("APP_PASSWORD", "PASSWORD") || "password#5515",
    JWT_SECRET: getRequiredEnv("JWT_SECRET"),
    DMS_PROD_DATABASE_URL: getRequiredEnv("DMS_PROD_DATABASE_URL"),
    ENTITIES_PROD_DATABASE_URL: getRequiredEnv("ENTITIES_PROD_DATABASE_URL"),
    MYSQL_HOST: getRequiredEnv("MYSQL_HOST"),
    MYSQL_USER: getRequiredEnv("MYSQL_USER"),
    MYSQL_PASSWORD: getRequiredEnv("MYSQL_PASSWORD"),
    MYSQL_DB: getRequiredEnv("MYSQL_DB"),
    AZURE_OPENAI_KEY: getRequiredEnv("AZURE_OPENAI_KEY"),
    AZURE_OPENAI_ENDPOINT: getRequiredEnv("AZURE_OPENAI_ENDPOINT"),
    AZURE_OPENAI_DEPLOYMENT: getRequiredEnv("AZURE_OPENAI_DEPLOYMENT"),
    AZURE_OPENAI_API_VERSION: getRequiredEnv("AZURE_OPENAI_API_VERSION"),
    AI_FOUNDRY_ENDPOINT: getRequiredEnv("AI_FOUNDRY_ENDPOINT"),
    PHPMYADMIN_URL: getRequiredEnv("PHPMYADMIN_URL"),
    HEALTH_CHECK_URL: getRequiredEnv("HEALTH_CHECK_URL"),
    MYSQL_PORT: getRequiredNumericEnv("MYSQL_PORT"),
    PORT: getOptionalNumericEnv("PORT", 3003),
    NODE_ENV: (process.env.NODE_ENV as "production" | "development" | "test") || "production",
}

// Client-side accessible environment variables (NEXT_PUBLIC_ prefix)
export const ENV = {
    NEXT_PUBLIC_BASE_URL: getRequiredEnv("NEXT_PUBLIC_BASE_URL"),
    NEXT_PUBLIC_BULK_DELETE_PATH: getOptionalEnv("NEXT_PUBLIC_BULK_DELETE_PATH", "/cleanup/entities/bulk-delete"),
    NEXT_PUBLIC_BACKEND_URL: getOptionalEnv("NEXT_PUBLIC_BACKEND_URL", "http://localhost:3005"),
}