import { redirect } from "next/navigation";
import { getViewer, homePathFor } from "@/lib/server/viewer";

export default async function HomePage() {
  redirect(homePathFor(await getViewer()));
}
