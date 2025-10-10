// Helper function to get required environment variable
function getRequiredEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Required environment variable ${key} is not set`);
    }
    return value;
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

export const ENV = {
    // Required environment variables
    USERNAME: getRequiredEnv("USERNAME"),
    PASSWORD: getRequiredEnv("PASSWORD"),
    JWT_SECRET: getRequiredEnv("JWT_SECRET"),
    NEXT_PUBLIC_BASE_URL: getRequiredEnv("NEXT_PUBLIC_BASE_URL"),
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

    // Optional environment variables with defaults
    NEXT_PUBLIC_BULK_DELETE_PATH: getOptionalEnv("NEXT_PUBLIC_BULK_DELETE_PATH", "/cleanup/entities/bulk-delete"),
    MYSQL_PORT: getRequiredNumericEnv("MYSQL_PORT"),
    PORT: getOptionalNumericEnv("PORT", 3003),
    NODE_ENV: (process.env.NODE_ENV as "production" | "development" | "test") || "production",
}