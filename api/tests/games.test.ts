import request from "supertest";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { createApp } from "../src/app";
import { prisma } from "../src/db";
import { dynamo, TABLE } from "../src/sessions";
import { centerOf, characters, photo, resetDb } from "./helpers";

const app = createApp();

beforeEach(resetDb);
afterAll(async () => (await prisma()).$disconnect());

async function startGame() {
  const res = await request(app).post("/api/games").send({ photoId: photo.id });
  return res.body.id as string;
}

const guess = (id: string, characterId: string, point: { x: number; y: number }) =>
  request(app).post(`/api/games/${id}/guesses`).send({ characterId, ...point });

describe("POST /api/games", () => {
  test("creates a session without leaking boxes", async () => {
    const res = await request(app).post("/api/games").send({ photoId: photo.id });
    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.photo).toMatchObject({ id: photo.id, width: 1000 });
    expect(res.body.characters).toEqual(characters.map(({ id, name, hint }) => ({ id, name, hint })));
    expect(JSON.stringify(res.body)).not.toMatch(/"x"|"w"/);
  });

  test("returns 404 for an unknown photo and 400 without one", async () => {
    expect((await request(app).post("/api/games").send({ photoId: "nope" })).status).toBe(404);
    expect((await request(app).post("/api/games").send({})).status).toBe(400);
  });
});

describe("POST /api/games/:id/guesses", () => {
  test("a wrong guess returns no box", async () => {
    const id = await startGame();
    const res = await guess(id, "a", { x: 0.5, y: 0.5 });
    expect(res.body).toEqual({ correct: false, finished: false });
  });

  test("a correct guess returns its box", async () => {
    const id = await startGame();
    const res = await guess(id, "a", centerOf(characters[0]));
    expect(res.body).toEqual({ correct: true, box: { x: 0.1, y: 0.1, w: 0.02, h: 0.04 }, finished: false });
  });

  test("repeated guesses count once and the last one finishes", async () => {
    const id = await startGame();
    await guess(id, "a", centerOf(characters[0]));
    const repeat = await guess(id, "a", centerOf(characters[0]));
    expect(repeat.body.finished).toBe(false);

    const last = await guess(id, "b", centerOf(characters[1]));
    expect(last.body).toMatchObject({ correct: true, finished: true, qualifies: true });
    expect(last.body.elapsedMs).toBeGreaterThanOrEqual(0);

    const after = await guess(id, "a", centerOf(characters[0]));
    expect(after.status).toBe(409);
  });

  test("ignores a client-sent time", async () => {
    const id = await startGame();
    await guess(id, "a", centerOf(characters[0]));
    const res = await request(app)
      .post(`/api/games/${id}/guesses`)
      .send({ characterId: "b", ...centerOf(characters[1]), elapsedMs: 1 });
    expect(res.body.elapsedMs).not.toBe(1);
  });

  test("rejects invalid bodies", async () => {
    const id = await startGame();
    expect((await guess(id, "a", { x: 2, y: 0.5 })).status).toBe(400);
    expect((await guess(id, "zzz", { x: 0.5, y: 0.5 })).status).toBe(404);
  });

  test("unknown sessions return 404 and expired ones 410", async () => {
    expect((await guess("missing", "a", { x: 0.5, y: 0.5 })).status).toBe(404);

    await dynamo.send(
      new PutCommand({
        TableName: TABLE,
        Item: { id: "old", photoId: photo.id, total: 2, startedAt: 0, ttl: Math.floor(Date.now() / 1000) - 1 },
      }),
    );
    expect((await guess("old", "a", centerOf(characters[0]))).status).toBe(410);
  });
});

describe("GET /api/photos/:id/leaderboard", () => {
  test("is scoped to one photo, sorted and limited to 10", async () => {
    const db = await prisma();
    await db.photo.create({ data: { ...photo, id: "other" } });
    await db.score.createMany({
      data: [
        ...Array.from({ length: 12 }, (_, i) => ({ sessionId: `s${i}`, photoId: photo.id, name: `P${i}`, elapsedMs: (12 - i) * 1000 })),
        { sessionId: "x", photoId: "other", name: "Other", elapsedMs: 1 },
      ],
    });

    const res = await request(app).get(`/api/photos/${photo.id}/leaderboard`);
    expect(res.body).toHaveLength(10);
    expect(res.body[0]).toMatchObject({ name: "P11", elapsedMs: 1000 });
    expect(res.body.map((s: { name: string }) => s.name)).not.toContain("Other");
  });
});

test("unknown routes return JSON 404, never 403", async () => {
  const res = await request(app).get("/api/nope");
  expect(res.status).toBe(404);
  expect(res.body).toEqual({ error: "Not found" });
});
