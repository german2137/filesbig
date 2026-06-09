import { Router } from "express";
import {
  LaunchSessionBody,
  GetSessionParams,
  StopSessionParams,
  UpdateSessionParams,
  UpdateSessionBody,
} from "@workspace/api-zod";
import {
  getAllSessions,
  getSession,
  getStats,
  launchSession,
  stopSession,
  deleteSession,
  updateSession,
} from "../lib/botManager";

const router = Router();

router.get("/bots/sessions", (_req, res) => {
  const sessions = getAllSessions();
  res.json(
    sessions.map((s) => ({
      id: s.id,
      host: s.host,
      port: s.port,
      botCount: s.botCount,
      delayMs: s.delayMs,
      status: s.status,
      connectedCount: s.connectedCount,
      failedCount: s.failedCount,
      errorMessage: s.errorMessage,
      createdAt: s.createdAt,
    }))
  );
});

router.post("/bots/sessions", async (req, res) => {
  const parsed = LaunchSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }

  const { host, port, botCount, delayMs } = parsed.data;
  const effectivePort = port ?? 25565;

  const session = await launchSession(host, effectivePort, botCount, delayMs);

  res.status(201).json({
    id: session.id,
    host: session.host,
    port: session.port,
    botCount: session.botCount,
    delayMs: session.delayMs,
    status: session.status,
    connectedCount: session.connectedCount,
    failedCount: session.failedCount,
    errorMessage: session.errorMessage,
    createdAt: session.createdAt,
  });
});

router.get("/bots/sessions/:id", (req, res) => {
  const parsed = GetSessionParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const session = getSession(parsed.data.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.json({
    id: session.id,
    host: session.host,
    port: session.port,
    botCount: session.botCount,
    delayMs: session.delayMs,
    status: session.status,
    connectedCount: session.connectedCount,
    failedCount: session.failedCount,
    errorMessage: session.errorMessage,
    createdAt: session.createdAt,
  });
});

router.post("/bots/sessions/:id/stop", (req, res) => {
  const parsed = StopSessionParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const stopped = stopSession(parsed.data.id);
  if (!stopped) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.json({ success: true, message: "Session stopped" });
});

router.delete("/bots/sessions/:id", (req, res) => {
  const parsed = StopSessionParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const deleted = deleteSession(parsed.data.id);
  if (!deleted) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.json({ success: true, message: "Session deleted" });
});

router.patch("/bots/sessions/:id", (req, res) => {
  const parsedParams = UpdateSessionParams.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsedBody = UpdateSessionBody.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ error: "Invalid input", details: parsedBody.error.flatten() });
    return;
  }

  const updated = updateSession(parsedParams.data.id, parsedBody.data);
  if (!updated) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.json({
    id: updated.id,
    host: updated.host,
    port: updated.port,
    botCount: updated.botCount,
    delayMs: updated.delayMs,
    status: updated.status,
    connectedCount: updated.connectedCount,
    failedCount: updated.failedCount,
    errorMessage: updated.errorMessage,
    createdAt: updated.createdAt,
  });
});

router.get("/bots/stats", (_req, res) => {
  res.json(getStats());
});

export default router;
