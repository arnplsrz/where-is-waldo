"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { listPhotos, type Photo } from "@/lib/game-api";

export default function Home() {
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    listPhotos().then(setPhotos, () => setFailed(true));
  }, []);

  return (
    <main className="mx-auto max-w-6xl w-full p-6 flex-1">
      <h1 className="text-3xl font-semibold">Where&apos;s Waldo? 🙈</h1>
      <p className="mt-1">Choose a photo, then find everyone as fast as you can.</p>
      {failed && <p role="alert" className="mt-6">Could not load photos. Try again later.</p>}
      {!photos && !failed && <p className="mt-6">Loading...</p>}
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {photos?.map((photo) => (
          <li key={photo.id} className="rounded border border-[#333] p-2">
            <Link href={`/play?photo=${photo.id}`} className="block hover:opacity-90">
              <Image src={photo.src} width={photo.width} height={photo.height} alt="" className="h-auto w-full" loading="eager" />
              <span className="mt-2 block font-medium">{photo.title}</span>
            </Link>
            <Link href={`/leaderboard?photo=${photo.id}`} className="text-sm underline">Leaderboard</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
