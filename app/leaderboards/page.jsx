import LeaderboardsClient from "./LeaderboardsClient";

export const metadata = {
  title: "BALLSVILLE Leaderboards",
  description: "Live leaderboards for BALLSVILLE game modes.",
};

export default function LeaderboardsPage() {
  return <LeaderboardsClient />;
}
