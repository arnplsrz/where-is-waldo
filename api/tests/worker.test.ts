import type { SQSEvent } from "aws-lambda";
import { prisma } from "../src/db";
import { handler } from "../src/worker";
import { photo, resetDb } from "./helpers";

beforeEach(resetDb);
afterAll(async () => (await prisma()).$disconnect());

const event = (...bodies: string[]) =>
  ({ Records: bodies.map((body, i) => ({ messageId: `m${i}`, body })) }) as SQSEvent;

const score = JSON.stringify({ sessionId: "s1", photoId: photo.id, name: "Ada", elapsedMs: 4200 });

test("stores a score", async () => {
  expect(await handler(event(score))).toEqual({ batchItemFailures: [] });
  const db = await prisma();
  expect(await db.score.findMany()).toMatchObject([{ sessionId: "s1", name: "Ada", elapsedMs: 4200 }]);
});

test("a duplicate message leaves one row", async () => {
  await handler(event(score, score));
  await handler(event(score));
  expect(await (await prisma()).score.count()).toBe(1);
});

test("reports only the bad message as failed", async () => {
  const result = await handler(event("not json", score));
  expect(result.batchItemFailures).toEqual([{ itemIdentifier: "m0" }]);
  expect(await (await prisma()).score.count()).toBe(1);
});
