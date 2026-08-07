/**
 * Stand-in for the `server-only` package, used by the integration tests.
 *
 * `server-only` throws on import outside a React Server Component, which is exactly what
 * makes it useful: a client component that reaches for `lib/server/*` fails the build
 * rather than shipping a database URL to a browser. The integration suite runs in Node,
 * on the server side of that line, so the guard has nothing to protect there — it would
 * only prevent the tests from importing the modules they exist to test.
 *
 * Aliased for the integration project only. The unit project keeps the real package, so
 * the guard still fires if pure domain code accidentally picks up a server import.
 */
export {};
