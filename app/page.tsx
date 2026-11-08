import Image from "next/image";
import Link from "next/link";
import { listPhotos } from "@/lib/game-api";

export default async function Home() {
  const photos = await listPhotos();

  return (
    <main className="mx-auto max-w-6xl w-full p-6 flex-1">
      <h1 className="text-3xl font-semibold">Where&apos;s Waldo? 🙈</h1>
      <p className="mt-1">Choose a photo, then find everyone as fast as you can.</p>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {photos.map((photo) => (
          <li key={photo.id}>
            <Link href={`/play?photo=${photo.id}`} className="block rounded border border-[#333] p-2 hover:bg-zinc-500/10">
              <Image src={photo.src} width={photo.width} height={photo.height} alt="" className="h-auto w-full" loading="eager" />
              <span className="mt-2 block font-medium">{photo.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
