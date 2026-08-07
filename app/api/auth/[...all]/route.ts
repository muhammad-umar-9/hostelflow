import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/server/auth";

/**
 * The only authentication endpoint. Sign-up is disabled in the Better Auth
 * configuration, so this serves sign-in, sign-out and session reads; it cannot be used to
 * create an account.
 *
 * The handler is built per request rather than at module scope. `next build` imports this
 * module to collect its configuration, and constructing Better Auth at import time would
 * make a production build require AUTH_SECRET and a database URL. `auth()` memoizes, so
 * this costs nothing after the first call.
 *
 * `force-dynamic` because every response depends on the request's cookies. A cached
 * auth response would be a session leak between users.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return toNextJsHandler(auth()).GET(request);
}

export async function POST(request: Request): Promise<Response> {
  return toNextJsHandler(auth()).POST(request);
}
