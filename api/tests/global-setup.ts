import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { CreateTableCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import dynalite from "dynalite";

export default async function globalSetup() {
  if (existsSync(".env")) process.loadEnvFile();
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.slice(1).startsWith("test_")) {
    throw new Error("TEST_DATABASE_URL must point at a database named test_*");
  }
  execSync("prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DIRECT_URL: url } });

  const server = dynalite({ createTableMs: 0 });
  await new Promise<void>((resolve) => server.listen(4568, resolve));
  (globalThis as { dynalite?: typeof server }).dynalite = server;

  const client = new DynamoDBClient({
    endpoint: "http://localhost:4568",
    region: "local",
    credentials: { accessKeyId: "local", secretAccessKey: "local" },
  });
  await client.send(
    new CreateTableCommand({
      TableName: "sessions",
      AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
      KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
      BillingMode: "PAY_PER_REQUEST",
    }),
  );
}
