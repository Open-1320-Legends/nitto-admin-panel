import { useQuery } from "@tanstack/react-query";

import { fetchSession, type SessionResult } from "@/lib/admin-api";

export const sessionQueryOptions = {
  queryKey: ["admin", "session"] as const,
  queryFn: fetchSession,
  staleTime: 30_000,
  retry: false,
};

export function useAdminSession() {
  const query = useQuery<SessionResult>(sessionQueryOptions);
  const result = query.data;
  return {
    ...query,
    result,
    session: result?.state === "authenticated" ? result.session : null,
    apiOffline: result?.state === "unavailable",
  };
}
