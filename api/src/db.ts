import { PrismaPg } from "@prisma/adapter-pg";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { PrismaClient } from "./generated/prisma/client";

let client: Promise<PrismaClient> | undefined;

async function databaseUrl() {
  if (process.env.NODE_ENV === "test") return process.env.TEST_DATABASE_URL!;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const { Parameter } = await new SSMClient({}).send(
    new GetParameterCommand({ Name: process.env.DATABASE_URL_PARAM, WithDecryption: true }),
  );
  return Parameter!.Value!;
}

export function prisma() {
  client ??= databaseUrl()
    .then((connectionString) => new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 1 }) }))
    .catch((error) => {
      client = undefined;
      throw error;
    });
  return client;
}
