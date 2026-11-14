import { Suspense } from "react";
import { Leaderboard } from "./leaderboard";

export default function LeaderboardPage() {
  return (
    <Suspense fallback={<p className="p-6">Loading...</p>}>
      <Leaderboard />
    </Suspense>
  );
}
