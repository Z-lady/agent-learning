# 📚 RAG Agent (Step 6)

Chat with your own documents. The agent retrieves relevant passages
and answers questions using ONLY your files — no internet needed.

## Project Structure

```
rag-agent/
├── src/
│   ├── rag.ts      ← 🧠 Chunking + TF-IDF retrieval + AI generation
│   └── server.ts   ← 🌐 Express server + file upload endpoints
├── public/
│   └── index.html  ← 🎨 3-panel UI (docs, chat, retrieved chunks)
├── docs/           ← 📁 Drop your .txt or .md files here!
│   ├── ai-agents-guide.md
│   ├── typescript-patterns.md
│   └── openrouter-guide.md
├── .env
└── package.json
```

## Setup

```bash
# 1. Install
npm install

# 2. Add your OpenRouter key to .env
OPENROUTER_API_KEY=sk-or-v1-...

# 3. Run (port 3003)
npm run dev

# 4. Open
http://localhost:3003
```

## How RAG Works (the 3 steps in rag.ts)

### Step 1 — Index
Read all .txt and .md files from /docs, split into ~500 char overlapping chunks.
Each chunk remembers its source filename.

### Step 2 — Retrieve
When you ask a question, score every chunk using TF-IDF:
- Find words shared between the question and each chunk
- Prefer rare words (more specific = more relevant)
- Return the top 4 highest-scoring chunks

### Step 3 — Generate
Send: question + top 4 chunks → AI
The system prompt forces the AI to answer ONLY from the chunks.
This prevents hallucination — if the answer isn't in your docs,
it says "I don't have that information."

## Adding Your Own Documents

Just drop any .txt or .md file into the /docs folder
— OR — use the upload button in the UI.

The index rebuilds automatically. Then ask questions about your files!

## Why TF-IDF instead of Embeddings?

Production RAG uses vector embeddings + a vector database (Pinecone, Chroma, Weaviate).
That requires an embeddings API and adds complexity.

TF-IDF is used here because:
- Zero extra dependencies or API keys
- You can see exactly how the math works
- Good enough for hundreds of documents
- Easy to upgrade to embeddings later

## What's Next?

You've completed all 6 steps! Your next learning path:

1. **Upgrade retrieval** — swap TF-IDF for real embeddings (OpenAI text-embedding-3-small)
2. **Add a vector DB** — try Chroma (local) or Pinecone (cloud)
3. **Support PDFs** — add pdf-parse to extract text from PDF files
4. **Production frameworks** — try LangChain or LlamaIndex which handle all this for you
