import { redirect } from "next/navigation";
import { LoginForm } from "@/components/forms/login-form";
import { safeNextPath } from "@/lib/public-routes";
import { getViewer, homePathFor } from "@/lib/server/viewer";

/**
 * Signing in again while already signed in is never what someone meant to do, and the
 * form would silently reissue a session. Send them where they belong instead — which is
 * decided here, from their membership, not by anything the browser asked for.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await getViewer();
  if (viewer.signedIn) redirect(homePathFor(viewer));

  // Where the middleware sent them from. Validated here rather than in the client
  // component: an absolute or protocol-relative value would make this an open redirect on
  // the domain residents are told to trust with photographs of their identity cards.
  const raw = (await searchParams).next;
  const next = safeNextPath(typeof raw === "string" ? raw : null);

  return <LoginForm next={next} />;
}
