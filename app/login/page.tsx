import { redirect } from "next/navigation";
import { LoginForm } from "@/components/forms/login-form";
import { getViewer, homePathFor } from "@/lib/server/viewer";

/**
 * Signing in again while already signed in is never what someone meant to do, and the
 * form would silently reissue a session. Send them where they belong instead — which is
 * decided here, from their membership, not by anything the browser asked for.
 */
export default async function LoginPage() {
  const viewer = await getViewer();
  if (viewer.signedIn) redirect(homePathFor(viewer));

  return <LoginForm />;
}
