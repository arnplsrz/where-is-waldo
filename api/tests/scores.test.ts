import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/db";
import { publishScore } from "../src/publish";
import { centerOf, characters, photo, resetDb } from "./helpers";

jest.mock("../src/publish");
const publish = jest.mocked(publishScore);

const app = createApp();

beforeEach(async () => {
  publish.mockReset();
  await resetDb();
});
afterAll(async () => (await prisma()).$disconnect());

async function startGame() {
  const res = await request(app).post("/api/games").send({ photoId: photo.id });
  return res.body.id as string;
}

async function finishGame() {
  const id = await startGame();
  for (const c of characters) {
    await request(app).post(`/api/games/${id}/guesses`).send({ characterId: c.id, ...centerOf(c) });
  }
  return id;
}

const submit = (id: string, name: unknown) => request(app).post(`/api/games/${id}/score`).send({ name });

test("rejects a score before the game finishes", async () => {
  const id = await startGame();
  expect((await submit(id, "Ada")).status).toBe(409);
  expect(publish).not.toHaveBeenCalled();
});

test("publishes a finished score once", async () => {
  const id = await finishGame();
  const res = await submit(id, "  Ada  ");
  expect(res.status).toBe(202);
  expect(publish).toHaveBeenCalledTimes(1);
  expect(publish).toHaveBeenCalledWith({ sessionId: id, photoId: photo.id, name: "Ada", elapsedMs: expect.any(Number) });
});

test("rejects a repeat submission", async () => {
  const id = await finishGame();
  await submit(id, "Ada");
  expect((await submit(id, "Eve")).status).toBe(409);
  expect(publish).toHaveBeenCalledTimes(1);
});

test("rejects bad names and unknown games", async () => {
  const id = await finishGame();
  expect((await submit(id, "")).status).toBe(400);
  expect((await submit("missing", "Ada")).status).toBe(404);
});

test("a failed publish can be retried", async () => {
  const id = await finishGame();
  publish.mockRejectedValueOnce(new Error("sns down"));
  expect((await submit(id, "Ada")).status).toBe(500);
  expect((await submit(id, "Ada")).status).toBe(202);
});
