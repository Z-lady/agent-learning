# 🤖 Multi-Agent Research System (Step 5)

An orchestrator delegates to 3 specialist sub-agents to research
any topic and produce a structured report.

## Project Structure

```
multi-agent/
├── src/
│   ├── agents.ts   ← 🧠 All agents + orchestrator logic
│   └── server.ts   ← 🌐 Express server + SSE streaming
├── public/
│   └── index.html  ← 🎨 Pipeline visualization UI
├── .env
└── package.json
```

## Setup

```bash
# 1. Install
npm install

# 2. Add your keys to .env (same keys as web-search-agent!)
OPENROUTER_API_KEY=sk-or-v1-...
TAVILY_API_KEY=tvly-...

# 3. Run (port 3002 — different from your other project!)
npm run dev

# 4. Open
http://localhost:3002
```

---

## The Pipeline

```
User Request
     ↓
Orchestrator  — extracts topic, coordinates pipeline
     ↓
Researcher    — searches web (Tavily), organizes facts
     ↓
Analyst       — extracts 3-5 key insights from research
     ↓
Writer        — writes structured markdown report
     ↓
Final Report
```

## Key Lesson

Each "agent" is just `callAI()` with a different system prompt.
That's it. The power comes from:

1. **Specialization** — each agent does ONE thing well
2. **Chaining** — output of one becomes input of the next
3. **Separation** — the orchestrator never does the actual work

## The ONE function that powers everything

```ts
async function callAI(systemPrompt, userMessage, apiKey) {
  // calls OpenRouter with different system prompts
  // that's ALL an "agent" is
}
```

## Next Step → Step 6: RAG

Give your agent a folder of your own documents and let it
answer questions by searching through them.
