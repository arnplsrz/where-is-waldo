import { Suspense } from "react";
import { Game } from "./game";

export default function PlayPage() {
  return (
    <Suspense fallback={<p className="p-6">Loading...</p>}>
      <Game />
    </Suspense>
  );
}
