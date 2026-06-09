import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListSessions,
  useLaunchSession,
  useStopSession,
  useDeleteSession,
  useUpdateSession,
  useGetBotStats,
  getListSessionsQueryKey,
  getGetBotStatsQueryKey,
} from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Terminal, Activity, Server, Users, StopCircle, Play, Cpu, Trash2, Pencil } from "lucide-react";

const launchSchema = z.object({
  host: z.string().min(1, "Server IP/Domain is required"),
  port: z.coerce.number().optional().nullable(),
  botCount: z.coerce.number().min(1, "Must be at least 1").max(500, "Max 500 bots"),
  delayMs: z.coerce.number().min(0, "Delay cannot be negative"),
});

type LaunchValues = z.infer<typeof launchSchema>;

export default function Home() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: stats } = useGetBotStats({ query: { queryKey: getGetBotStatsQueryKey(), refetchInterval: 2000 } });
  const { data: sessions } = useListSessions({ query: { queryKey: getListSessionsQueryKey(), refetchInterval: 2000 } });

  const launchMutation = useLaunchSession();
  const stopMutation = useStopSession();
  const deleteMutation = useDeleteSession();
  const updateMutation = useUpdateSession();

  const form = useForm<LaunchValues>({
    resolver: zodResolver(launchSchema),
    defaultValues: {
      host: "",
      port: 25565,
      botCount: 10,
      delayMs: 100,
    },
  });

  const onSubmit = (values: LaunchValues) => {
    launchMutation.mutate(
      { data: { host: values.host, port: values.port ?? null, botCount: values.botCount, delayMs: values.delayMs } },
      {
        onSuccess: () => {
          toast({ title: "Launch Initiated", description: `Launching ${values.botCount} bots to ${values.host}` });
          queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetBotStatsQueryKey() });
          form.reset();
        },
        onError: (error: unknown) => {
          const msg = error instanceof Error ? error.message : "An error occurred";
          toast({ title: "Launch Failed", description: msg, variant: "destructive" });
        },
      }
    );
  };

  const handleStop = (id: string) => {
    stopMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Session Stopped", description: `Session ${id.substring(0, 8)} has been stopped.` });
          queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetBotStatsQueryKey() });
        },
        onError: (error: unknown) => {
          const msg = error instanceof Error ? error.message : "An error occurred";
          toast({ title: "Stop Failed", description: msg, variant: "destructive" });
        },
      }
    );
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Session Deleted", description: `Session ${id.substring(0, 8)} has been removed.` });
          queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetBotStatsQueryKey() });
        },
        onError: (error: unknown) => {
          const msg = error instanceof Error ? error.message : "An error occurred";
          toast({ title: "Delete Failed", description: msg, variant: "destructive" });
        },
      }
    );
  };

  const handleEdit = (id: string, host: string, port: number, botCount: number, delayMs: number) => {
    const newHost = prompt("Host/IP:", host);
    if (newHost === null) return;
    const newPort = prompt("Port:", String(port));
    if (newPort === null) return;
    const newBotCount = prompt("Bot Count:", String(botCount));
    if (newBotCount === null) return;
    const newDelayMs = prompt("Spawn Delay (ms):", String(delayMs));
    if (newDelayMs === null) return;

    updateMutation.mutate(
      { id, data: { host: newHost || undefined, port: Number(newPort) || undefined, botCount: Number(newBotCount) || undefined, delayMs: Number(newDelayMs) || undefined } },
      {
        onSuccess: () => {
          toast({ title: "Session Updated", description: `Session ${id.substring(0, 8)} has been updated.` });
          queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetBotStatsQueryKey() });
        },
        onError: (error: unknown) => {
          const msg = error instanceof Error ? error.message : "An error occurred";
          toast({ title: "Update Failed", description: msg, variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-12 font-mono">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-6">
          <div className="flex items-center gap-3">
            <Terminal className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground uppercase">
                STORM<span className="text-primary">NET</span> OPS
              </h1>
              <p className="text-muted-foreground text-sm tracking-widest uppercase">
                Distributed Minecraft Testing Console
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
            </span>
            <span className="text-primary font-medium tracking-wider">SYSTEM ONLINE</span>
          </div>
        </div>

        {/* Global Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Active Sessions" value={stats?.activeSessions ?? 0} icon={<Activity className="w-4 h-4 text-primary" />} />
          <StatCard title="Total Sessions" value={stats?.totalSessions ?? 0} icon={<Server className="w-4 h-4 text-muted-foreground" />} />
          <StatCard title="Total Bots Connected" value={stats?.totalBotsConnected ?? 0} icon={<Users className="w-4 h-4 text-primary" />} />
          <StatCard title="Total Bots Launched" value={stats?.totalBotsLaunched ?? 0} icon={<Cpu className="w-4 h-4 text-muted-foreground" />} />
        </div>

        <div className="grid md:grid-cols-12 gap-8">
          {/* Launch Control */}
          <Card className="md:col-span-4 bg-card border-border shadow-md">
            <CardHeader className="border-b border-border/50 bg-muted/20">
              <CardTitle className="text-lg uppercase tracking-wider flex items-center gap-2">
                <Play className="w-4 h-4 text-primary" /> Launch Sequence
              </CardTitle>
              <CardDescription>Configure bot swarm parameters.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="host"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs uppercase tracking-wider">Target Host/IP</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="mc.example.com"
                            className="font-mono bg-background border-border focus-visible:ring-primary"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="port"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs uppercase tracking-wider">Port</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="25565"
                              className="font-mono bg-background border-border focus-visible:ring-primary"
                              {...field}
                              value={field.value ?? ""}
                              onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="botCount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs uppercase tracking-wider">Bot Count</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              className="font-mono bg-background border-border focus-visible:ring-primary"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="delayMs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs uppercase tracking-wider">Spawn Delay (ms)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            className="font-mono bg-background border-border focus-visible:ring-primary"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    disabled={launchMutation.isPending}
                    className="w-full mt-4 font-mono font-bold tracking-widest uppercase bg-primary text-primary-foreground hover:bg-primary/90 rounded-sm"
                  >
                    {launchMutation.isPending ? "INITIALIZING..." : "EXECUTE LAUNCH"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Sessions Feed */}
          <div className="md:col-span-8 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold tracking-wider uppercase flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" /> Session Uplink
              </h2>
              <Badge variant="outline" className="font-mono bg-background text-muted-foreground border-border rounded-sm">
                Live Feed
              </Badge>
            </div>

            <div className="space-y-3">
              {!sessions || sessions.length === 0 ? (
                <div className="border border-dashed border-border rounded p-8 text-center bg-card/30">
                  <p className="text-muted-foreground uppercase tracking-widest text-sm">No active sessions.</p>
                </div>
              ) : (
                sessions.map((session) => (
                  <Card
                    key={session.id}
                    className={`bg-card border-border shadow-sm overflow-hidden ${session.errorMessage ? 'border-destructive/30' : ''}`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between p-4 gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground truncate max-w-[200px] md:max-w-xs">
                            {session.host}:{session.port}
                          </span>
                          <StatusBadge status={session.status} />
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-4">
                          <span>ID: {session.id.substring(0, 8)}</span>
                          <span>Delay: {session.delayMs}ms</span>
                        </div>
                        {session.errorMessage && (
                          <p className="text-xs text-destructive font-mono mt-1 max-w-md leading-relaxed">
                            {session.errorMessage}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="flex flex-col items-center">
                          <span className="text-xs uppercase text-muted-foreground tracking-wider">Connected</span>
                          <span className="font-bold text-primary">
                            {session.connectedCount} / {session.botCount}
                          </span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-xs uppercase text-muted-foreground tracking-wider">Failed</span>
                          <span className="font-bold text-destructive">{session.failedCount}</span>
                        </div>
                        <div className="pl-4 border-l border-border flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(session.id, session.host, session.port, session.botCount, session.delayMs)}
                            disabled={session.status === "spawning" || session.status === "running" || updateMutation.isPending}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-accent"
                            title="Edit session"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(session.id)}
                            disabled={deleteMutation.isPending}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title="Delete session"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleStop(session.id)}
                            disabled={session.status === "stopped" || stopMutation.isPending}
                            className="h-8 rounded-sm uppercase tracking-wider text-xs font-bold w-24"
                          >
                            <StopCircle className="w-3 h-3 mr-1" />
                            {stopMutation.isPending ? "HALTING" : "TERMINATE"}
                          </Button>
                        </div>
                      </div>
                    </div>
                    {session.status === "spawning" && (
                      <div className="h-1 w-full bg-background overflow-hidden">
                        <div className="h-full bg-primary/50 w-full origin-left animate-pulse"></div>
                      </div>
                    )}
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
  return (
    <Card className="bg-card border-border rounded-sm">
      <CardContent className="p-4 flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold font-mono text-foreground">{value}</p>
        </div>
        <div className="p-2 bg-background rounded-sm border border-border">{icon}</div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const getProps = () => {
    switch (status) {
      case "spawning":
        return { className: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20", label: "SPAWNING", pulse: true };
      case "running":
        return { className: "bg-primary/10 text-primary border-primary/20", label: "RUNNING", pulse: false };
      case "stopped":
        return { className: "bg-muted/50 text-muted-foreground border-border", label: "STOPPED", pulse: false };
      case "failed":
        return { className: "bg-destructive/10 text-destructive border-destructive/20", label: "FAILED", pulse: false };
      default:
        return { className: "bg-muted text-muted-foreground", label: status, pulse: false };
    }
  };

  const props = getProps();

  return (
    <Badge
      variant="outline"
      className={`font-mono text-[10px] rounded-sm tracking-wider uppercase border px-2 py-0.5 ${props.className}`}
    >
      {props.pulse && <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping mr-1.5 inline-block" />}
      {!props.pulse && <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 inline-block" />}
      {props.label}
    </Badge>
  );
}
