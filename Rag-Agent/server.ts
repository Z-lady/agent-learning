// ============================================================
// 🌐 server.ts — RAG Agent Server (port 3003)
// ============================================================

import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import multer from "multer";
import { buildIndex, askWithRAG, getIndexedDocs } from "./rag.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3003;
const DOCS_DIR = path.join(__dirname, "./docs");

app.use(express.json());
app.use(express.static(path.join(__dirname, "./public")));

// ── File Upload Setup ────────────────────────────────────────
// Multer handles file uploads — saves .txt and .md files to /docs
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, DOCS_DIR),
  filename: (_req, file, cb) => cb(null, file.originalname),
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const allowed = [".txt", ".md"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only .txt and .md files are allowed"));
    }
  },
});

// ── Build index on startup ───────────────────────────────────
buildIndex(DOCS_DIR);

// ── GET /api/check ───────────────────────────────────────────
app.get("/api/check", (_req, res) => {
  const key = process.env.OPENROUTER_API_KEY ?? "";
  res.json({ ok: key.startsWith("sk-or-") });
});

// ── GET /api/docs ────────────────────────────────────────────
// Returns list of indexed documents + stats
app.get("/api/docs", (_req, res) => {
  res.json({ docs: getIndexedDocs() });
});

// ── POST /api/upload ─────────────────────────────────────────
// Accepts a .txt or .md file, saves it, rebuilds the index
app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }
  // Rebuild the index to include the new file
  buildIndex(DOCS_DIR);
  res.json({
    ok: true,
    filename: req.file.originalname,
    docs: getIndexedDocs(),
  });
});

// ── DELETE /api/docs/:filename ───────────────────────────────
// Deletes a document and rebuilds the index
app.delete("/api/docs/:filename", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(DOCS_DIR, filename);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  fs.unlinkSync(filePath);
  buildIndex(DOCS_DIR);
  res.json({ ok: true, docs: getIndexedDocs() });
});

// ── POST /api/ask ────────────────────────────────────────────
// Main RAG endpoint — retrieves relevant chunks + generates answer
app.post("/api/ask", async (req, res) => {
  const apiKey = process.env.OPENROUTER_API_KEY ?? "";

  if (!apiKey.startsWith("sk-or-")) {
    res.status(401).json({ error: "OPENROUTER_API_KEY not set in .env" });
    return;
  }

  const { question } = req.body as { question: string };

  if (!question?.trim()) {
    res.status(400).json({ error: "Question is required" });
    return;
  }

  try {
    const { answer, chunks } = await askWithRAG(question, apiKey);
    res.json({ answer, chunks });
  } catch (err: unknown) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

// ── Start ────────────────────────────────────────────────────
app.listen(PORT, () => {
  const key = process.env.OPENROUTER_API_KEY ?? "";
  console.log(`
╔══════════════════════════════════════════════╗
║         📚  RAG Agent                        ║
╠══════════════════════════════════════════════╣
║  URL        →  http://localhost:${PORT}          ║
║  Docs dir   →  ./docs/                       ║
║  OpenRouter →  ${key.startsWith("sk-or-") ? "✅ found" : "❌ NOT SET — edit .env"}
╚══════════════════════════════════════════════╝
  `);
});
