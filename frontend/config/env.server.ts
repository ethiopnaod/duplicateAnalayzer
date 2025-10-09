// Server-only environment variables
// Do not import this into client components
export const ENV_SERVER = {
    USERNAME: process.env.USERNAME as string,
    PASSWORD: process.env.PASSWORD as string,
    JWT_SECRET: process.env.JWT_SECRET as string,
    // Optional extras for future server-side usage
    DMS_PROD_DATABASE_URL: process.env.DMS_PROD_DATABASE_URL,
    ENTITIES_PROD_DATABASE_URL: process.env.ENTITIES_PROD_DATABASE_URL,
    MYSQL_HOST: process.env.MYSQL_HOST,
    MYSQL_PORT: process.env.MYSQL_PORT,
    MYSQL_USER: process.env.MYSQL_USER,
    MYSQL_PASSWORD: process.env.MYSQL_PASSWORD,
    MYSQL_DB: process.env.MYSQL_DB,
    AZURE_OPENAI_KEY: process.env.AZURE_OPENAI_KEY,
    AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT,
    AZURE_OPENAI_DEPLOYMENT: process.env.AZURE_OPENAI_DEPLOYMENT,
    AZURE_OPENAI_API_VERSION: process.env.AZURE_OPENAI_API_VERSION,
    AI_FOUNDRY_ENDPOINT: process.env.AI_FOUNDRY_ENDPOINT,
}


