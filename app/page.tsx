import { redirect } from "next/navigation";

// Beakon opens on the timeline by default (spec §UX).
export default function Home() {
  redirect("/timeline");
}
