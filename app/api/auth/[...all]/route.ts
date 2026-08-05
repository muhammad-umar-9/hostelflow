import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/server/auth";

/**
 * The only authentication endpoint. Sign-up is disabled in the Better Auth
 * configuration, so this serves sign-in, sign-out and session reads; it cannot be used
 * to create an account.
 *
 * `force-dynamic` because every response depends on the request's cookies. A cached
 * auth response would be a session leak between users.
 */
export const dynamic = "force-dynamic";

const handler = toNextJsHandler(auth());

export const GET = handler.GET;
export const POST = handler.POST;
