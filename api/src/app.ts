import { randomUUID } from "node:crypto";
import express, { type ErrorRequestHandler, type Request, type Response } from "express";
import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { prisma } from "./db";
import { hitTest, isExpired, LEADERBOARD_SIZE, qualifies, SESSION_TTL_MS } from "./game";
import { dynamo, type Session, TABLE } from "./sessions";

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

async function loadSession(id: string, now: number) {
  const { Item } = await dynamo.send(new GetCommand({ TableName: TABLE, Key: { id } }));
  if (!Item) throw new HttpError(404, "Game not found");
  const session = Item as Session;
  if (isExpired(session, now)) throw new HttpError(410, "Game expired");
  return session;
}

async function topTimes(photoId: string) {
  const db = await prisma();
  const scores = await db.score.findMany({
    where: { photoId },
    orderBy: [{ elapsedMs: "asc" }, { createdAt: "asc" }],
    take: LEADERBOARD_SIZE,
    select: { name: true, elapsedMs: true, createdAt: true },
  });
  return scores;
}

export function createApp() {
  const app = express();
  const api = express.Router();
  app.use(express.json({ limit: "2kb" }));

  if (process.env.CORS_ORIGIN) {
    app.use((req, res, next) => {
      res.set("Access-Control-Allow-Origin", process.env.CORS_ORIGIN);
      res.set("Access-Control-Allow-Headers", "Content-Type");
      if (req.method === "OPTIONS") return res.sendStatus(204);
      next();
    });
  }

  api.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  api.get("/photos", async (_req, res) => {
    const db = await prisma();
    res.json(await db.photo.findMany({ orderBy: { title: "asc" } }));
  });

  api.get("/photos/:id/leaderboard", async (req, res) => {
    res.json(await topTimes(req.params.id));
  });

  api.post("/games", async (req: Request, res: Response) => {
    const photoId = req.body?.photoId;
    if (typeof photoId !== "string") throw new HttpError(400, "photoId is required");
    const db = await prisma();
    const photo = await db.photo.findUnique({
      where: { id: photoId },
      include: { characters: { select: { id: true, name: true, hint: true }, orderBy: { id: "asc" } } },
    });
    if (!photo) throw new HttpError(404, "Photo not found");

    const now = Date.now();
    const id = randomUUID();
    const session: Session = {
      id,
      photoId,
      total: photo.characters.length,
      startedAt: now,
      ttl: Math.floor((now + SESSION_TTL_MS) / 1000),
    };
    await dynamo.send(new PutCommand({ TableName: TABLE, Item: session }));

    const { characters, ...rest } = photo;
    res.status(201).json({ id, photo: rest, characters });
  });

  api.post("/games/:id/guesses", async (req: Request<{ id: string }>, res: Response) => {
    const { characterId, x, y } = req.body ?? {};
    const valid = typeof characterId === "string" && [x, y].every((v) => typeof v === "number" && v >= 0 && v <= 1);
    if (!valid) throw new HttpError(400, "characterId, x and y are required");

    const now = Date.now();
    const session = await loadSession(req.params.id, now);
    if (session.finishedAt) throw new HttpError(409, "Game already finished");

    const db = await prisma();
    const character = await db.character.findFirst({
      where: { id: characterId, photoId: session.photoId },
      include: { photo: { select: { width: true, height: true } } },
    });
    if (!character) throw new HttpError(404, "Character not found");

    const { photo, x: bx, y: by, w, h } = character;
    const box = { x: bx, y: by, w, h };
    if (!hitTest(x, y, box, photo.height / photo.width)) {
      return res.json({ correct: false, finished: false });
    }

    const { Attributes } = await dynamo.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { id: session.id },
        UpdateExpression: "ADD #found :c",
        ExpressionAttributeNames: { "#found": "found" },
        ExpressionAttributeValues: { ":c": new Set([characterId]) },
        ReturnValues: "ALL_NEW",
      }),
    );
    const updated = Attributes as Session;
    if ((updated.found?.size ?? 0) < updated.total) {
      return res.json({ correct: true, box, finished: false });
    }

    const elapsedMs = now - updated.startedAt;
    try {
      await dynamo.send(
        new UpdateCommand({
          TableName: TABLE,
          Key: { id: session.id },
          UpdateExpression: "SET finishedAt = :now, elapsedMs = :elapsed",
          ConditionExpression: "attribute_not_exists(finishedAt)",
          ExpressionAttributeValues: { ":now": now, ":elapsed": elapsedMs },
        }),
      );
    } catch (error) {
      if ((error as Error).name !== "ConditionalCheckFailedException") throw error;
      throw new HttpError(409, "Game already finished");
    }

    const top = await topTimes(session.photoId);
    res.json({
      correct: true,
      box,
      finished: true,
      elapsedMs,
      qualifies: qualifies(elapsedMs, top.map((score) => score.elapsedMs)),
    });
  });

  app.use("/api", api);

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
    if (error?.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON" });
    console.error(error);
    res.status(500).json({ error: "Internal error" });
  };
  app.use(handleError);

  return app;
}
