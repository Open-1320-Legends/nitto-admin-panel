import { createFileRoute } from "@tanstack/react-router";

/*
 * The real admin API lives on the game server, not on this host. Without this
 * catch-all, any /api/admin/* fetch hits the router with no matching route and
 * the SSR handler answers 500 with an HTML-ish error body — which surfaces as a
 * blank screen. Answering with a small JSON 404 lets the client mark the API as
 * "not available here" and render its offline state instead.
 */
const unavailable = () =>
  Response.json(
    { ok: false, reason: "admin_api_not_mounted" },
    { status: 404, headers: { "cache-control": "no-store" } },
  );

export const Route = createFileRoute("/api/admin/$")({
  server: {
    handlers: {
      GET: unavailable,
      POST: unavailable,
      PUT: unavailable,
      PATCH: unavailable,
      DELETE: unavailable,
    },
  },
});
