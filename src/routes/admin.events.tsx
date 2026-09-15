import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, Square, XCircle } from "lucide-react";
import { toast } from "sonner";

import { PageHeading } from "@/components/admin/shell";
import {
  Cell,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  Panel,
  Pill,
  Row,
  StatTile,
  type PillTone,
} from "@/components/admin/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, dateLabel, integer } from "@/lib/admin-api";

export const Route = createFileRoute("/admin/events")({
  head: () => ({
    meta: [
      { title: "Events — 1320 Legends Race Control" },
      { name: "description", content: "Run tournaments, seed schedules and award event prizes." },
      { property: "og:title", content: "Events — 1320 Legends Race Control" },
      { property: "og:description", content: "Run tournaments and award event prizes." },
    ],
  }),
  component: EventsPage,
});

type Tournament = {
  id?: number;
  name?: string;
  status?: string;
  entrants?: number;
  entryFee?: number;
  startsAt?: string;
};

function statusTone(status?: string): PillTone {
  const value = String(status ?? "").toLowerCase();
  if (value === "running" || value === "live") return "success";
  if (value === "scheduled" || value === "pending") return "warning";
  if (value === "cancelled" || value === "canceled") return "danger";
  return "neutral";
}

function EventsPage() {
  const queryClient = useQueryClient();

  const tournaments = useQuery({
    queryKey: ["admin", "tournaments"],
    queryFn: () =>
      api<{ tournaments?: Tournament[]; items?: Tournament[] }>("/api/admin/tournaments"),
    retry: false,
  });

  const control = useMutation({
    mutationFn: ({ id, verb }: { id: number; verb: "start" | "stop" | "cancel" }) =>
      api(`/api/admin/tournaments/${id}/${verb}`, { method: "POST" }),
    onSuccess: (_data, variables) => {
      toast.success(
        `Tournament ${variables.verb === "cancel" ? "cancelled" : variables.verb + "ed"}.`,
      );
      queryClient.invalidateQueries({ queryKey: ["admin", "tournaments"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const award = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api("/api/admin/events/award", { method: "POST", body }),
    onSuccess: () => toast.success("Award recorded."),
    onError: (error: Error) => toast.error(error.message),
  });

  const list = tournaments.data?.tournaments ?? tournaments.data?.items ?? [];
  const running = list.filter((item) => statusTone(item.status) === "success");

  return (
    <>
      <PageHeading
        title="Events"
        subtitle="Tournament schedule, live brackets and manual prize awards."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Running now" value={integer(running.length)} tone="success" />
        <StatTile label="On the calendar" value={integer(list.length)} tone="primary" />
        <StatTile
          label="Entrants (running)"
          value={integer(running.reduce((total, item) => total + Number(item.entrants ?? 0), 0))}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Panel title="Tournaments" count={list.length}>
          {tournaments.isLoading ? (
            <LoadingState label="Reading the schedule" />
          ) : tournaments.isError ? (
            <ErrorState error={tournaments.error} what="tournaments" />
          ) : list.length === 0 ? (
            <EmptyState>Nothing scheduled.</EmptyState>
          ) : (
            <DataTable head={["Event", "Status", "Entrants", "Starts", "Control"]}>
              {list.map((item, index) => (
                <Row key={item.id ?? index}>
                  <Cell className="font-medium">{item.name || `Tournament #${item.id}`}</Cell>
                  <Cell>
                    <Pill tone={statusTone(item.status)}>{item.status || "draft"}</Pill>
                  </Cell>
                  <Cell mono>{integer(item.entrants)}</Cell>
                  <Cell mono className="text-muted-foreground">
                    {dateLabel(item.startsAt)}
                  </Cell>
                  <Cell>
                    <div className="flex gap-1.5">
                      <Button
                        size="icon"
                        variant="outline"
                        aria-label="Start"
                        disabled={control.isPending || !item.id}
                        onClick={() => control.mutate({ id: Number(item.id), verb: "start" })}
                      >
                        <Play className="size-3.5" aria-hidden />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        aria-label="Stop"
                        disabled={control.isPending || !item.id}
                        onClick={() => control.mutate({ id: Number(item.id), verb: "stop" })}
                      >
                        <Square className="size-3.5" aria-hidden />
                      </Button>
                      <Button
                        size="icon"
                        variant="destructive"
                        aria-label="Cancel"
                        disabled={control.isPending || !item.id}
                        onClick={() => control.mutate({ id: Number(item.id), verb: "cancel" })}
                      >
                        <XCircle className="size-3.5" aria-hidden />
                      </Button>
                    </div>
                  </Cell>
                </Row>
              ))}
            </DataTable>
          )}
        </Panel>

        <Panel title="Award a prize" note="Manual payout">
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              award.mutate({
                accountId: Number(data.get("accountId") || 0),
                points: Number(data.get("points") || 0),
                money: Number(data.get("money") || 0),
                reason: String(data.get("reason") || ""),
              });
            }}
          >
            <Field label="Account ID">
              <Input name="accountId" type="number" required placeholder="10241" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Points">
                <Input name="points" type="number" min={0} defaultValue={0} />
              </Field>
              <Field label="Cash">
                <Input name="money" type="number" min={0} defaultValue={0} />
              </Field>
            </div>
            <Field label="Reason">
              <Input name="reason" required placeholder="Won Friday night eliminator" />
            </Field>
            <Button type="submit" disabled={award.isPending}>
              Award prize
            </Button>
          </form>
        </Panel>
      </div>
    </>
  );
}
