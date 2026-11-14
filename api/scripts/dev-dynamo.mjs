import { CreateTableCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import dynalite from "dynalite";

const port = 4567;
await new Promise((resolve) => dynalite({ createTableMs: 0 }).listen(port, resolve));
await new DynamoDBClient({
  endpoint: `http://localhost:${port}`,
  region: "local",
  credentials: { accessKeyId: "local", secretAccessKey: "local" },
}).send(
  new CreateTableCommand({
    TableName: "sessions",
    AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
    KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
    BillingMode: "PAY_PER_REQUEST",
  }),
);
console.log(`DynamoDB (dynalite) on http://localhost:${port}`);
