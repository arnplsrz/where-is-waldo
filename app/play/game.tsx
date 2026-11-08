"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type KeyboardEvent, type MouseEvent, useEffect, useRef, useState } from "react";
import { type Box, type Game as GameData, TARGET_RADIUS, startGame, submitGuess } from "@/lib/game-api";

type Point = { x: number; y: number };
type Marker = { characterId: string; name: string; box: Box };

const STEP = 0.01;
const LARGE_STEP = 0.05;
const MOVES: Record<string, Point> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};

const percent = (fraction: number) => `${fraction * 100}%`;
const clamp = (value: number) => Math.min(1, Math.max(0, value));

export function Game() {
  const photoId = useSearchParams().get("photo") ?? "";
  return <PhotoGame key={photoId} photoId={photoId} />;
}

function PhotoGame({ photoId }: { photoId: string }) {
  const [game, setGame] = useState<GameData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [target, setTarget] = useState<Point | null>(null);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [message, setMessage] = useState("Click the photo, or use the arrow keys and Enter, to tag a character.");
  const [finished, setFinished] = useState(false);
  const [pending, setPending] = useState(false);
  const photoRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    startGame(photoId)
      .then((created) => {
        if (!active) return;
        setGame(created);
        setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("failed");
      });
    return () => {
      active = false;
    };
  }, [photoId]);

  useEffect(() => {
    cursorRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [cursor]);

  useEffect(() => {
    if (!target) return;
    const dismissOutside = (event: PointerEvent) => {
      if (!photoRef.current?.contains(event.target as Node)) setTarget(null);
    };
    const dismissOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setTarget(null);
      photoRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [target]);

  if (status === "loading") return <p className="p-6">Loading...</p>;

  if (status === "failed") {
    return (
      <p role="alert" className="p-6">
        Could not start the game. <Link className="underline" href="/">Back to photos</Link>
      </p>
    );
  }

  if (!game) {
    return (
      <p className="p-6">
        Photo not found. <Link className="underline" href="/">Choose a photo</Link>
      </p>
    );
  }

  const handlePhotoClick = (event: MouseEvent<HTMLDivElement>) => {
    if (finished || pending) return;
    setCursor(null);
    if (target) {
      setTarget(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    setTarget({
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    });
  };

  const handlePhotoKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || finished || pending || target) return;
    const move = MOVES[event.key];
    if (move) {
      event.preventDefault();
      const step = event.shiftKey ? LARGE_STEP : STEP;
      setCursor((current) => {
        const from = current ?? { x: 0.5, y: 0.5 };
        return { x: clamp(from.x + move.x * step), y: clamp(from.y + move.y * step) };
      });
    } else if (cursor && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      setTarget(cursor);
    }
  };

  const handleSelect = async (characterId: string, name: string) => {
    if (!target || pending) return;
    setPending(true);
    try {
      const result = await submitGuess(characterId, target.x, target.y);
      if (result.correct && result.box) {
        const box = result.box;
        setMarkers((current) => [...current, { characterId, name, box }]);
        setMessage(`You found ${name}!`);
      } else {
        setMessage(`That's not ${name}. Keep looking.`);
      }
      if (result.finished) {
        setFinished(true);
        setCursor(null);
        setMessage("You found everyone!");
      }
    } catch {
      setMessage("Could not check that guess. Try again.");
    } finally {
      setPending(false);
      setTarget(null);
      photoRef.current?.focus({ preventScroll: true });
    }
  };

  const foundIds = new Set(markers.map((marker) => marker.characterId));
  const remaining = game.characters.filter((character) => !foundIds.has(character.id));
  const ring = target ?? cursor;
  const ringStyle = ring && {
    left: percent(ring.x),
    top: percent(ring.y),
    width: percent(TARGET_RADIUS * 2),
  };

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 p-4">
      <header className="mb-3">
        <h1 className="text-2xl font-semibold">{game.photo.title}</h1>
        <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {game.characters.map((character) => {
            const isFound = foundIds.has(character.id);
            return (
              <li key={character.id} className={isFound ? "line-through opacity-60" : ""}>
                <strong>{character.name}</strong>: {character.hint}
              </li>
            );
          })}
        </ul>
        <p role="status" className="mt-2 min-h-6 font-medium">
          {message}
        </p>
      </header>

      <div className="overflow-auto rounded">
        <div
          ref={photoRef}
          role="group"
          tabIndex={0}
          aria-label={`${game.photo.title}. Use the arrow keys to move the target, hold Shift for larger steps, and press Enter to tag.`}
          onClick={handlePhotoClick}
          onKeyDown={handlePhotoKeyDown}
          className="relative min-w-225 cursor-crosshair select-none"
        >
          <Image
            src={game.photo.src}
            width={game.photo.width}
            height={game.photo.height}
            alt={`${game.photo.title}, a crowded scene to search`}
            draggable={false}
            className="block h-auto w-full"
            loading="eager" />

          {markers.map(({ characterId, name, box }) => (
            <div
              key={characterId}
              className="pointer-events-none absolute rounded border-2 border-green-600 bg-green-500/20"
              style={{
                left: percent(box.x),
                top: percent(box.y),
                width: percent(box.w),
                height: percent(box.h),
              }}
            >
              <span className="absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap rounded bg-green-700 px-1 text-xs text-white">
                {name}
              </span>
            </div>
          ))}

          {ringStyle && (
            <div
              ref={cursorRef}
              className={`pointer-events-none absolute aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-red-600 shadow ${target ? "" : "border-dashed"}`}
              style={ringStyle} />
          )}

          {target && (
            <div
              role="group"
              aria-label="Who is here?"
              onClick={(event) => event.stopPropagation()}
              className="absolute z-10 flex min-w-36 flex-col rounded border border-zinc-300 bg-white p-1 text-black shadow-lg"
              style={{
                left: target.x > 0.8 ? undefined : `calc(${percent(target.x + TARGET_RADIUS)} + 6px)`,
                right: target.x > 0.8 ? `calc(${percent(1 - target.x + TARGET_RADIUS)} + 6px)` : undefined,
                top: target.y > 0.8 ? undefined : percent(target.y),
                bottom: target.y > 0.8 ? percent(1 - target.y) : undefined,
              }}
            >
              {remaining.map(({ id, name }, index) => (
                <button
                  key={id}
                  type="button"
                  autoFocus={index === 0}
                  disabled={pending}
                  onClick={() => handleSelect(id, name)}
                  className="rounded px-3 py-1.5 text-left hover:bg-zinc-200 focus:bg-zinc-200"
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {finished && (
        <p className="mt-4">
          <Link className="underline" href="/">Play again</Link>
        </p>
      )}
    </main>
  );
}
