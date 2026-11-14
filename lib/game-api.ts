export type Box = { x: number; y: number; w: number; h: number };

export type Character = { id: string; name: string; hint: string };

export type Photo = { id: string; title: string; src: string; width: number; height: number };

export type Game = { id: string; photo: Photo; characters: Character[] };

export type GuessResult = { correct: boolean; box?: Box; finished: boolean; elapsedMs?: number; qualifies?: boolean };

export type Score = { name: string; elapsedMs: number; createdAt: string };

export const TARGET_RADIUS = 0.015;

const BASE = `${process.env.NEXT_PUBLIC_API_URL ?? ""}/api`;

class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export const listPhotos = () => call<Photo[]>("/photos");

export async function startGame(photoId: string): Promise<Game | null> {
  try {
    return await call<Game>("/games", { photoId });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export const submitGuess = (gameId: string, characterId: string, x: number, y: number) =>
  call<GuessResult>(`/games/${gameId}/guesses`, { characterId, x, y });

export const submitScore = (gameId: string, name: string) => call<unknown>(`/games/${gameId}/score`, { name });

export const getLeaderboard = (photoId: string) => call<Score[]>(`/photos/${encodeURIComponent(photoId)}/leaderboard`);

export const formatTime = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
