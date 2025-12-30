import { redirect } from "next/navigation";

// Legacy route kept for old links/bookmarks.
export default function DynastyWageringDemoRedirect() {
  redirect("/dynasty/wagers");
}
