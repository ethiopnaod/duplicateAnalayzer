export const ENV = {
    USERNAME: "admin#5515",
    PASSWORD: "password#5515",
    JWT_SECRET: "fe8ry8q4yribqifa",

    NEXT_PUBLIC_BASE_URL: "http://localhost:3005/api/v1",

    // Optional: set a backend bulk delete path for entities
    NEXT_PUBLIC_BULK_DELETE_PATH: "/cleanup/entities/bulk-delete",

    DMS_PROD_DATABASE_URL: "mysql://dms-dev2:D99S6DFIE534N@4.234.194.233:3308/DMS_PROD",
    ENTITIES_PROD_DATABASE_URL: "mysql://dms-dev2:D99S6DFIE534N@4.234.194.233:3308/ENTITIES_PROD",
    MYSQL_HOST: "4.234.194.233",
    MYSQL_PORT: 3308,
    MYSQL_USER: "dms-dev2",
    MYSQL_PASSWORD: "d",
    MYSQL_DB: "DMS_PROD",

    AZURE_OPENAI_KEY: "4M9yzPYlocMdIUdPoOzL3dnxZfGJb8pZN0PQFyM8inWTBNjtiDVXJQQJ99BGACmepeSXJ3w3AAAAACOGWIWK",
    AZURE_OPENAI_ENDPOINT: "https://ai-dms.openai.azure.com",
    AZURE_OPENAI_DEPLOYMENT: "gpt-35-turbo",
    AZURE_OPENAI_API_VERSION: "2024-12-01-preview",
    AI_FOUNDRY_ENDPOINT: "https://ai-dms.services.ai.azure.com/",

    PHPMYADMIN_URL: "https://ai2.dealmakersystem.com/myadmin/",
    PORT: 3003,
    NODE_ENV: "production" as "production" | "development" | "test",
    HEALTH_CHECK_URL: "http://localhost:3000/api/v1/health",
}