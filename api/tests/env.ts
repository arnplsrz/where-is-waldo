import { existsSync } from "node:fs";

if (existsSync(".env")) process.loadEnvFile();
process.env.DYNAMODB_ENDPOINT = "http://localhost:4568";
process.env.SESSIONS_TABLE = "sessions";
delete process.env.CORS_ORIGIN;
