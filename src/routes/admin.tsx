import { createFileRoute, Outlet, Link } from "@tanstack/react-router";

import { AdminShell } from "@/components/admin/shell";
import { LoadingState, Pill } from "@/components/admin/primitives";
import { sessionUsable } from "@/lib/admin-api";
import { useAdminSession } from "@/lib/use-admin-session";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { session, apiOffline, isLoading, result } = useAdminSession();

  if (isLoading) {
    return (
      <div className="carbon-grid min-h-screen px-6 py-10">
        <LoadingState label="Checking your staff session" />
      </div>
    );
  }

  // Only a definite "not signed in" answer from the API sends staff back to
  // the sign-in screen. An unreachable API is a connectivity problem, not a
  // permission one, so the console still renders with a banner.
  if (result?.state === "anonymous") {
    return (
      <div className="carbon-grid flex min-h-screen items-center justify-center px-4">
        <div className="relative z-10 max-w-sm rounded-xl border border-border bg-card p-6 text-center shadow-panel">
          <Pill tone="warning">Session required</Pill>
          <h1 className="mt-3 text-lg font-semibold">Sign in to continue</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your staff session has expired or was never started.
          </p>
          <Link
            to="/"
            className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  const pending = session && !sessionUsable(session);

  return (
    <AdminShell
      session={session}
      banner={
        apiOffline ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-warning/30 bg-warning/10 px-5 py-2.5 text-xs text-muted-foreground">
            <Pill tone="warning">API offline</Pill>
            Not connected to the game server — panels show their empty state instead of live data.
          </div>
        ) : pending ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-warning/30 bg-warning/10 px-5 py-2.5 text-xs text-muted-foreground">
            <Pill tone="warning">Approval pending</Pill>
            An owner still needs to approve your access. Changes you make are queued for review.
          </div>
        ) : null
      }
    >
      <Outlet />
    </AdminShell>
  );
}
