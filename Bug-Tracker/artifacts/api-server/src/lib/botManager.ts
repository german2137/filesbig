import { randomUUID } from "crypto";
import { logger } from "./logger";

export type SessionStatus = "spawning" | "running" | "stopped" | "failed";

export interface BotSession {
  id: string;
  host: string;
  port: number;
  botCount: number;
  delayMs: number;
  status: SessionStatus;
  connectedCount: number;
  failedCount: number;
  errorMessage: string;
  createdAt: string;
  bots: unknown[];
  stopRequested: boolean;
}

const sessions = new Map<string, BotSession>();

export function getAllSessions(): BotSession[] {
  return Array.from(sessions.values()).map(toPublic);
}

export function getSession(id: string): BotSession | undefined {
  const s = sessions.get(id);
  return s ? toPublic(s) : undefined;
}

export function getStats() {
  const all = Array.from(sessions.values());
  const active = all.filter(
    (s) => s.status === "spawning" || s.status === "running"
  );
  return {
    totalSessions: all.length,
    activeSessions: active.length,
    totalBotsLaunched: all.reduce((acc, s) => acc + s.botCount, 0),
    totalBotsConnected: all.reduce((acc, s) => acc + s.connectedCount, 0),
  };
}

export async function launchSession(
  host: string,
  port: number,
  botCount: number,
  delayMs: number
): Promise<BotSession> {
  const id = randomUUID();
  const session: BotSession = {
    id,
    host,
    port,
    botCount,
    delayMs,
    status: "spawning",
    connectedCount: 0,
    failedCount: 0,
    errorMessage: "",
    createdAt: new Date().toISOString(),
    bots: [],
    stopRequested: false,
  };

  sessions.set(id, session);

  // Quick reachability check
  const reachable = await checkServerReachable(host, port);
  if (!reachable) {
    session.status = "failed";
    session.errorMessage = `Server ${host}:${port} is unreachable from this environment. The bot manager must run on the same network as the Minecraft server.`;
    return toPublic(session);
  }

  spawnBots(session).catch((err) => {
    logger.error({ err, sessionId: id }, "Unhandled error in spawnBots");
    session.status = "failed";
  });

  return toPublic(session);
}

async function spawnBots(session: BotSession): Promise<void> {
  let mineflayer: typeof import("mineflayer") | null = null;
  try {
    mineflayer = await import("mineflayer");
  } catch (e) {
    logger.error({ err: (e as Error).message }, "Failed to load mineflayer");
    session.status = "failed";
    return;
  }

  for (let i = 0; i < session.botCount; i++) {
    if (session.stopRequested) break;

    const username = `Bot_${session.id.slice(0, 6)}_${i}`;

    try {
      const bot = mineflayer.createBot({
        host: session.host,
        port: session.port,
        username,
        auth: "offline",
        hideErrors: false,
      } as import("mineflayer").BotOptions);

      session.bots.push(bot);
      let spawned = false;
      let errored = false;
      let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

      const cleanup = () => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }
      };

      timeoutHandle = setTimeout(() => {
        if (!spawned && !errored && !session.stopRequested) {
          errored = true;
          session.failedCount++;
          logger.warn({ sessionId: session.id, username }, "Bot connection timeout");
          try { bot.quit("Connection timeout"); } catch {}
          checkAllDone(session);
        }
      }, 30000);

      bot.on("login", () => {
        logger.info({ sessionId: session.id, username }, "Bot logged in");
      });

      bot.on("spawn", () => {
        cleanup();
        if (!session.stopRequested && !spawned) {
          spawned = true;
          session.connectedCount++;
          if (session.status === "spawning") {
            session.status = "running";
          }
        }
        logger.info({ sessionId: session.id, username }, "Bot spawned successfully");
      });

      bot.on("end", (reason: string) => {
        cleanup();
        if (spawned && !session.stopRequested) {
          session.connectedCount = Math.max(0, session.connectedCount - 1);
        }
        logger.info({ sessionId: session.id, username, reason }, "Bot ended");
        checkAllDone(session);
      });

      bot.on("error", (err: Error) => {
        cleanup();
        if (!errored && !session.stopRequested) {
          errored = true;
          session.failedCount++;
        }
        logger.warn({ sessionId: session.id, username, err: err.message }, "Bot error");
        checkAllDone(session);
      });
    } catch (err) {
      session.failedCount++;
      logger.warn({ sessionId: session.id, username, err: (err as Error).message }, "Failed to create bot instance");
      checkAllDone(session);
    }

    if (i < session.botCount - 1 && session.delayMs > 0 && !session.stopRequested) {
      await sleep(session.delayMs);
    }
  }

  if (!session.stopRequested && session.status === "spawning") {
    session.status = session.failedCount === session.botCount ? "failed" : "running";
  }
}

function checkStatus(session: BotSession) {
  const allFinished = session.connectedCount + session.failedCount >= session.botCount;
  if (allFinished && !session.stopRequested && session.status !== "stopped" && session.status !== "failed") {
    if (session.connectedCount === 0) {
      session.status = "failed";
    } else if (session.failedCount === session.botCount) {
      session.status = "failed";
    } else {
      session.status = "running";
    }
  }
}

function checkAllDone(session: BotSession) {
  if (session.stopRequested && session.connectedCount === 0) {
    session.status = "stopped";
  }
}

export function stopSession(id: string): boolean {
  const session = sessions.get(id);
  if (!session) return false;

  session.stopRequested = true;
  session.status = "stopped";

  for (const bot of session.bots) {
    try {
      (bot as { quit: (reason: string) => void }).quit("Session stopped");
    } catch {
    }
  }
  session.bots = [];
  session.connectedCount = 0;
  return true;
}

export function deleteSession(id: string): boolean {
  const session = sessions.get(id);
  if (!session) return false;

  if (session.status === "spawning" || session.status === "running") {
    stopSession(id);
  }

  sessions.delete(id);
  logger.info({ sessionId: id }, "Session deleted");
  return true;
}

export function updateSession(
  id: string,
  params: { host?: string; port?: number; botCount?: number; delayMs?: number }
): BotSession | null {
  const session = sessions.get(id);
  if (!session) return null;

  if (params.host !== undefined) session.host = params.host;
  if (params.port !== undefined) session.port = params.port;
  if (params.botCount !== undefined) session.botCount = params.botCount;
  if (params.delayMs !== undefined) session.delayMs = params.delayMs;

  logger.info({ sessionId: id, params }, "Session updated");
  return toPublic(session);
}

function toPublic(s: BotSession): BotSession {
  const { bots: _bots, stopRequested: _stopRequested, ...rest } = s;
  return { ...rest, bots: [], stopRequested: false };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function checkServerReachable(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const net = require("net");
    const socket = new net.Socket();
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 5000);

    socket.on("connect", () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve(true);
    });

    socket.on("error", () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, host);
  });
}
