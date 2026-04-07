// ============================================================
// 🌐 server.ts — Multi-Agent Server
// Runs on port 3002 (so it doesn't clash with your other project)
// ============================================================

import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { orchestrate } from "./agents.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3002;

app.use(express.json());
app.use(express.static(path.join(__dirname, "./public")));

// Health check — verifies both API keys are set
app.get("/api/check", (_req, res) => {
  const orKey = process.env.OPENROUTER_API_KEY ?? "";
  const tvKey = process.env.TAVILY_API_KEY ?? "";
  res.json({
    ok: orKey.startsWith("sk-or-") && tvKey.startsWith("tvly-"),
    openrouter: orKey.startsWith("sk-or-"),
    tavily: tvKey.startsWith("tvly-"),
  });
});

// Main endpoint — runs the multi-agent pipeline, streams events back
app.post("/api/research", async (req, res) => {
  const orKey = process.env.OPENROUTER_API_KEY ?? "";
  const tvKey = process.env.TAVILY_API_KEY ?? "";

  if (!orKey.startsWith("sk-or-")) {
    res.status(401).json({ error: "OPENROUTER_API_KEY not set" });
    return;
  }
  if (!tvKey.startsWith("tvly-")) {
    res.status(401).json({ error: "TAVILY_API_KEY not set" });
    return;
  }

  const { request } = req.body as { request: string };

  // SSE — stream each agent's progress in real time
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  try {
    for await (const event of orchestrate(request, orKey, tvKey)) {
      send(event);
    }
  } catch (err: unknown) {
    send({
      type: "error",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }

  res.end();
});

app.listen(PORT, () => {
  const orKey = process.env.OPENROUTER_API_KEY ?? "";
  const tvKey = process.env.TAVILY_API_KEY ?? "";
  console.log(`
╔══════════════════════════════════════════════╗
║       🤖  Multi-Agent System                 ║
╠══════════════════════════════════════════════╣
║  URL        →  http://localhost:${PORT}          ║
║  OpenRouter →  ${orKey.startsWith("sk-or-") ? "✅ found" : "❌ NOT SET"}
║  Tavily     →  ${tvKey.startsWith("tvly-") ? "✅ found" : "❌ NOT SET"}
╚══════════════════════════════════════════════╝
  `);
});
