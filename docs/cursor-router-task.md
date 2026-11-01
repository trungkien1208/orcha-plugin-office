# Cursor task: HTTP router on Hono, browser socket on partysocket

Two library swaps that touch the security boundary, so they get their own branch (`be/router`) and review.
Read `packages/bridge/CLAUDE.md` and the root `CLAUDE.md` (local only, token, Host/Origin checks) first.
One commit per task, `bun run check` after each, no push.

## R1. Routes on Hono

Today `packages/bridge/src/http/routes.ts` is one function with ~40 `if (req.method === … && path …)` branches,
each parsing its own body with zod and mapping errors by hand.

- Add `hono` and `@hono/zod-validator` (exact versions, at least two weeks old).
- Build one `Hono` app per server: middleware for the Host check, the Origin check and the bearer token (from
  `http/guard.ts`, unchanged rules), then the existing routes with `zValidator` for bodies and params.
- One `onError` that keeps today's mapping: `ActionError` → its status, `OrchaError` timeout/closed → 503,
  `ZodError` → 400, anything else → 500, always `{ error }` and never a stack trace or token.
- `server.ts` keeps serving static files and the WebSocket; it hands `/api/*` to `app.fetch`.
- Every path, method, status code and response shape stays the same. The web app and `e2e/` must not change.

Done when: `bun run check` passes, `bun run test:e2e` passes, and the route tests cover: missing token → 401,
foreign Origin → 403, wrong Host → 403, a bad body → 400 with `{ error }`, an Orcha timeout → 503.

## R2. Browser reconnect on partysocket

Today `packages/web/src/store.ts` reconnects the WebSocket by hand (`retry * 2` up to 5 s) and guards stale
sockets itself.

- Add `partysocket` (its `ReconnectingWebSocket`) with the same protocols (`easy-job.<token>`), backoff 0.5 s → 5 s,
  and no reconnect when the token is missing (the entry gate shows instead).
- Keep the visible behaviour: the "Reconnecting…" notice, `snap.socket` states, re-subscribing the watched
  conversation on reopen, and the versioned `state` handling.

Done when: `e2e/acceptance.spec.ts` "stopping the bridge shows reconnecting, and the same token comes back live"
passes, and closing the bridge for 30 s then starting it again reconnects without a reload.
