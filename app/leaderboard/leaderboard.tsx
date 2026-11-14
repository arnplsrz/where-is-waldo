"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { formatTime, getLeaderboard, type Score } from "@/lib/game-api";

const LEADERBOARD_SIZE = 10;

function readMine(photoId: string): Score | null {
  try {
    const raw = sessionStorage.getItem(`waldo:mine:${photoId}`);
    return raw ? (JSON.parse(raw) as Score) : null;
  } catch {
    return null;
  }
}

export function withMine(scores: Score[], mine: Score | null): Score[] {
  if (mine === null) return scores
  const duplicate = scores.some(score =>
    score.name === mine.name &&
    score.elapsedMs === mine.elapsedMs
  )
  if (!duplicate) return [...scores, mine].sort((a, b) => a.elapsedMs - b.elapsedMs);
  return scores
}

export function Leaderboard() {
  const photoId = useSearchParams().get("photo") ?? "";
  const [scores, setScores] = useState<Score[] | null>(null);
  const [mine, setMine] = useState<Score | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setMine(readMine(photoId));
    getLeaderboard(photoId).then(setScores, () => setFailed(true));
  }, [photoId]);

  const rows = scores && withMine(scores, mine);

  return (
    <main className="mx-auto w-full max-w-xl flex-1 p-6">
      <h1 className="text-2xl font-semibold">Leaderboard</h1>
      {failed && <p role="alert" className="mt-4">Could not load the leaderboard.</p>}
      {!rows && !failed && <p className="mt-4">Loading...</p>}
      {rows && rows.length === 0 && <p className="mt-4">No scores yet. Be the first!</p>}
      {rows && rows.length > 0 && (
        <ol className="mt-4 divide-y divide-[#333]">
          {rows.slice(0, LEADERBOARD_SIZE).map((score, index) => (
            <li
              key={`${score.name}-${score.createdAt}`}
              className={`flex justify-between py-2 ${score === mine ? "font-semibold text-green-500" : ""}`}
            >
              <span>
                {index + 1}. {score.name}
              </span>
              <span className="font-mono tabular-nums">{formatTime(score.elapsedMs)}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-6 flex gap-4">
        <Link className="underline" href={`/play?photo=${photoId}`}>Play</Link>
        <Link className="underline" href="/">All photos</Link>
      </p>
    </main>
  );
}
