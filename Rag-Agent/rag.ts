// ============================================================
// 📚 rag.ts — RAG Engine (Step 6)
//
// RAG = Retrieval-Augmented Generation
//
// How it works in 3 steps:
//
//   STEP 1: INDEX
//     Read all .txt/.md files from /docs folder
//     Split each file into small overlapping chunks
//     Store chunks in memory with their source filename
//
//   STEP 2: RETRIEVE
//     When user asks a question, find the most relevant chunks
//     We use TF-IDF similarity — a classic text search algorithm
//     No vector database needed — pure TypeScript, zero dependencies!
//
//   STEP 3: GENERATE
//     Send the question + relevant chunks to the AI
//     AI answers using ONLY the provided context
//     Cites which document the answer came from
//
// WHY NO VECTOR DB?
//   Production RAG uses embeddings + vector databases (Pinecone, Chroma)
//   for semantic search. We use TF-IDF here because:
//   - Zero extra dependencies or API keys
//   - You can see exactly how retrieval works
//   - Good enough for learning the concept
//   - Easy to swap for embeddings later
// ============================================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface Chunk {
  id: string;         // unique ID e.g. "ai-agents-guide.md:0"
  source: string;     // filename e.g. "ai-agents-guide.md"
  text: string;       // the actual text content
  score?: number;     // relevance score (added during retrieval)
}

export interface IndexedDoc {
  filename: string;
  chunks: Chunk[];
  charCount: number;
}

// In-memory store — reloaded whenever documents change
let index: Chunk[] = [];
let indexedDocs: IndexedDoc[] = [];

// ─────────────────────────────────────────────────────────────
// STEP 1: INDEXING
//
// Reads all .txt and .md files from the docs folder,
// splits them into overlapping chunks of ~500 chars.
//
// WHY CHUNKS?
//   The AI can't read your whole document at once (context limit).
//   Chunking lets us select ONLY the relevant pieces.
//
// WHY OVERLAP?
//   Overlap (100 chars) prevents important sentences from being
//   split across chunk boundaries and lost.
// ─────────────────────────────────────────────────────────────
export function buildIndex(docsDir: string): IndexedDoc[] {
  index = [];
  indexedDocs = [];

  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
    return [];
  }

  const files = fs.readdirSync(docsDir).filter(
    f => f.endsWith(".txt") || f.endsWith(".md")
  );

  for (const filename of files) {
    const filePath = path.join(docsDir, filename);
    const text = fs.readFileSync(filePath, "utf-8");
    const chunks = chunkText(text, filename);

    index.push(...chunks);
    indexedDocs.push({
      filename,
      chunks,
      charCount: text.length,
    });
  }

  console.log(`📚 Indexed ${files.length} documents → ${index.length} chunks`);
  return indexedDocs;
}

// Split text into overlapping chunks
function chunkText(text: string, source: string, chunkSize = 500, overlap = 100): Chunk[] {
  const chunks: Chunk[] = [];

  // Split on paragraph boundaries first for cleaner chunks
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = "";
  let chunkIndex = 0;

  for (const para of paragraphs) {
    if ((currentChunk + para).length > chunkSize && currentChunk.length > 0) {
      chunks.push({
        id: `${source}:${chunkIndex}`,
        source,
        text: currentChunk.trim(),
      });
      chunkIndex++;
      // Overlap: keep the last `overlap` chars from the previous chunk
      currentChunk = currentChunk.slice(-overlap) + "\n\n" + para;
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + para;
    }
  }

  // Don't forget the last chunk
  if (currentChunk.trim()) {
    chunks.push({
      id: `${source}:${chunkIndex}`,
      source,
      text: currentChunk.trim(),
    });
  }

  return chunks;
}

// ─────────────────────────────────────────────────────────────
// STEP 2: RETRIEVAL — TF-IDF Similarity Search
//
// TF-IDF = Term Frequency × Inverse Document Frequency
//
// In plain terms:
//   - Find words that appear in BOTH the query and a chunk
//   - Prefer words that are RARE across all chunks (more specific)
//   - Return the top-K most relevant chunks
//
// Example:
//   Query: "how do agents use tools?"
//   Word "tools" appears in 3 chunks → medium IDF score
//   Word "agents" appears in 8 chunks → lower IDF score
//   Chunk with BOTH words scores highest
//
// This is how Google worked in 1998 — simple but effective!
// ─────────────────────────────────────────────────────────────
export function retrieve(query: string, topK = 4): Chunk[] {
  if (index.length === 0) return [];

  const queryTokens = tokenize(query);

  // Calculate IDF (how rare each word is across ALL chunks)
  const df: Record<string, number> = {};
  for (const chunk of index) {
    const chunkTokens = new Set(tokenize(chunk.text));
    for (const token of chunkTokens) {
      df[token] = (df[token] ?? 0) + 1;
    }
  }

  const N = index.length;
  const idf = (token: string) => Math.log((N + 1) / ((df[token] ?? 0) + 1));

  // Score each chunk against the query
  const scored = index.map(chunk => {
    const chunkTokens = tokenize(chunk.text);
    const tf: Record<string, number> = {};
    for (const t of chunkTokens) tf[t] = (tf[t] ?? 0) + 1;

    // TF-IDF score = sum of (term freq × inverse doc freq) for shared terms
    let score = 0;
    for (const token of queryTokens) {
      if (tf[token]) {
        score += (tf[token] / chunkTokens.length) * idf(token);
      }
    }

    return { ...chunk, score };
  });

  // Return top K chunks by score, filtering out zero-score chunks
  return scored
    .filter(c => (c.score ?? 0) > 0)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, topK);
}

// Tokenize text into lowercase words, removing punctuation and stop words
function tokenize(text: string): string[] {
  const stopWords = new Set([
    "the","a","an","is","are","was","were","be","been","being",
    "have","has","had","do","does","did","will","would","could",
    "should","may","might","shall","can","need","dare","ought",
    "in","on","at","to","for","of","and","or","but","not","with",
    "from","by","as","this","that","these","those","it","its",
    "i","you","he","she","we","they","what","which","who","how",
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
}

// ─────────────────────────────────────────────────────────────
// STEP 3: GENERATION
//
// Takes the user's question + relevant chunks → calls AI.
//
// The system prompt is carefully crafted to:
//   - Force the AI to use ONLY the provided context
//   - Make it cite which document each answer comes from
//   - Tell it to say "I don't know" if the answer isn't in docs
//     (prevents hallucination — this is crucial for RAG!)
// ─────────────────────────────────────────────────────────────
export async function askWithRAG(
  question: string,
  apiKey: string
): Promise<{ answer: string; chunks: Chunk[] }> {

  // Retrieve relevant chunks
  const relevantChunks = retrieve(question, 4);

  if (relevantChunks.length === 0) {
    return {
      answer: "I couldn't find any relevant information in the loaded documents. Please make sure you have documents in the docs/ folder and they've been indexed.",
      chunks: [],
    };
  }

  // Build the context string from retrieved chunks
  const context = relevantChunks
    .map((c, i) => `[Source ${i + 1}: ${c.source}]\n${c.text}`)
    .join("\n\n---\n\n");

  // Call AI with context injected into the system prompt
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3003",
      "X-Title": "RAG Agent",
    },
    body: JSON.stringify({
      model: "openrouter/auto",
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant that answers questions using ONLY the provided document excerpts.

Rules:
- Answer using ONLY information from the provided sources below
- Always cite which source your answer comes from (e.g. "According to ai-agents-guide.md...")
- If the answer is not in the provided sources, say "I don't have information about that in the loaded documents"
- Never make up information or use outside knowledge
- Be concise and direct

PROVIDED DOCUMENT EXCERPTS:
${context}`,
        },
        {
          role: "user",
          content: question,
        },
      ],
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API error ${response.status}: ${err}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  return {
    answer: data.choices[0].message.content ?? "(no response)",
    chunks: relevantChunks,
  };
}

// ─────────────────────────────────────────────────────────────
// Getters for server.ts to use
// ─────────────────────────────────────────────────────────────
export function getIndex()      { return index; }
export function getIndexedDocs() { return indexedDocs; }
