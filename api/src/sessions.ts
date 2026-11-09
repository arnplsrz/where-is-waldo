import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

export const TABLE = process.env.SESSIONS_TABLE ?? "sessions";

export const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient(
    process.env.DYNAMODB_ENDPOINT
      ? { endpoint: process.env.DYNAMODB_ENDPOINT, region: "local", credentials: { accessKeyId: "local", secretAccessKey: "local" } }
      : {},
  ),
);

export type Session = {
  id: string;
  photoId: string;
  total: number;
  startedAt: number;
  ttl: number;
  found?: Set<string>;
  finishedAt?: number;
  elapsedMs?: number;
  submitted?: boolean;
};
