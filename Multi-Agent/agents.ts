// ============================================================
// 🤖 agents.ts — Multi-Agent System (Step 5)
//
// This file contains 5 "agents" — each is just an AI call
// with a different system prompt and purpose:
//
//   callAI()          — shared helper, calls OpenRouter
//   researcherAgent() — searches the web for raw facts
//   analystAgent()    — extracts key insights from research
//   writerAgent()     — turns insights into a polished report
//   orchestrator()    — the BOSS: plans, delegates, combines
//
// KEY INSIGHT:
//   An "agent" is not a special object or class.
//   It's just an AI call with a focused system prompt.
//   The "multi" in multi-agent just means you chain them.
// ============================================================

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type AgentEvent =
  | { type: "orchestrator"; message: string }
  | { type: "agent_start";  agent: string; task: string }
  | { type: "agent_done";   agent: string; preview: string }
  | { type: "final_report"; report: string }
  | { type: "error";        message: string };

// ─────────────────────────────────────────────────────────────
// 🔌 BASE: callAI
//
// Every agent uses this same function.
// The ONLY difference between agents is the `systemPrompt`.
// That's the whole secret of multi-agent systems.
// ─────────────────────────────────────────────────────────────
async function callAI(
  systemPrompt: string,
  userMessage: string,
  apiKey: string
): Promise<string> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3002",
      "X-Title": "Multi-Agent System",
    },
    body: JSON.stringify({
      model: "openrouter/auto",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userMessage  },
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

  return data.choices[0].message.content ?? "(no response)";
}

// ─────────────────────────────────────────────────────────────
// 🔍 SUB-AGENT 1: Researcher
//
// Specialty: web search — finds raw facts and sources.
// Has access to Tavily search API.
// Returns: bullet points of facts with source URLs.
//
// System prompt focus: "search thoroughly, cite everything,
// return raw facts — don't analyze or write prose"
// ─────────────────────────────────────────────────────────────
async function researcherAgent(
  topic: string,
  apiKey: string,
  tavilyKey: string
): Promise<string> {
  // First do the actual web search
  const searchRes = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tavilyKey}`,
    },
    body: JSON.stringify({
      query: topic,
      search_depth: "basic",
      max_results: 6,
      include_answer: true,
    }),
  });

  const searchData = await searchRes.json() as {
    answer?: string;
    results?: Array<{ title: string; url: string; content: string }>;
  };

  const rawResults = [
    searchData.answer ? `Overview: ${searchData.answer}` : "",
    ...(searchData.results ?? []).map(
      (r, i) => `[${i+1}] ${r.title}\nURL: ${r.url}\n${r.content.slice(0, 400)}`
    ),
  ].filter(Boolean).join("\n\n");

  // Then pass raw results to the Researcher AI to organize them
  return callAI(
    `You are a meticulous research agent. Your ONLY job is to extract and
organize factual information from search results. 
Rules:
- Return ONLY facts found in the provided search results
- Format as clear bullet points grouped by theme
- Include source URLs for every fact
- Do NOT analyze, interpret, or add your own knowledge
- Do NOT write prose paragraphs — only bullet points
- If something is unclear from the results, say so`,
    `Topic: ${topic}\n\nSearch results to organize:\n${rawResults}`,
    apiKey
  );
}

// ─────────────────────────────────────────────────────────────
// 📊 SUB-AGENT 2: Analyst
//
// Specialty: extracting meaning from raw research.
// Takes the researcher's bullet points and finds patterns,
// significance, and key takeaways.
//
// System prompt focus: "think critically, find what matters,
// identify themes — don't just repeat facts"
// ─────────────────────────────────────────────────────────────
async function analystAgent(
  topic: string,
  research: string,
  apiKey: string
): Promise<string> {
  return callAI(
    `You are a sharp analyst agent. You receive raw research and extract
the most important insights.
Rules:
- Identify the 3-5 most significant findings
- Explain WHY each finding matters
- Note any contradictions or gaps in the research
- Group related points into themes
- Be opinionated — say what is most important and why
- Keep each insight to 2-3 sentences maximum
- Do NOT just repeat facts — add analytical value`,
    `Topic: ${topic}\n\nRaw research to analyze:\n${research}`,
    apiKey
  );
}

// ─────────────────────────────────────────────────────────────
// ✍️  SUB-AGENT 3: Writer
//
// Specialty: turning analyzed insights into a readable report.
// Takes the analyst's insights and produces polished prose.
//
// System prompt focus: "write clearly for a smart non-expert,
// structure well, make it genuinely useful"
// ─────────────────────────────────────────────────────────────
async function writerAgent(
  topic: string,
  insights: string,
  apiKey: string
): Promise<string> {
  return callAI(
    `You are an expert writer agent. You turn analytical insights into
a clear, well-structured report for a smart non-expert reader.
Rules:
- Start with a 2-sentence executive summary
- Use clear section headers (##)
- Write in plain, direct English — no jargon without explanation
- Each section should be 2-4 sentences
- End with a "Key Takeaways" section (3 bullet points)
- Total length: 300-500 words
- Format: clean markdown`,
    `Topic: ${topic}\n\nInsights to write up:\n${insights}`,
    apiKey
  );
}

// ─────────────────────────────────────────────────────────────
// 🧠 ORCHESTRATOR
//
// The boss agent. Does NOT do any research, analysis, or writing.
// Its only job is to:
//   1. Understand what the user wants
//   2. Decide which agents to call and in what order
//   3. Pass results between agents
//   4. Return the final combined output
//
// This is an async generator so we can stream each step
// to the browser in real time as agents complete.
//
// NOTICE: The orchestrator calls agents SEQUENTIALLY here:
//   researcher → analyst → writer
// In production you'd run independent agents in PARALLEL
// with Promise.all() — but sequential is easier to learn first.
// ─────────────────────────────────────────────────────────────
export async function* orchestrate(
  userRequest: string,
  apiKey: string,
  tavilyKey: string
): AsyncGenerator<AgentEvent> {

  // Step 1 — Orchestrator plans the work
  yield {
    type: "orchestrator",
    message: `Analyzing request: "${userRequest}" → delegating to 3 specialist agents...`,
  };

  // Step 2 — Extract the research topic using AI
  // (handles cases where user says "write me a report about X"
  //  vs just "X" vs a complex multi-part request)
  const topic = await callAI(
    `Extract the core research topic from the user's request.
Return ONLY the topic as a short phrase — nothing else.
Examples:
  "Research Tesla and write a report" → "Tesla company"
  "What's happening with AI in 2025?" → "AI developments 2025"
  "Tell me about React 19" → "React 19 features"`,
    userRequest,
    apiKey
  );

  yield {
    type: "orchestrator",
    message: `Identified topic: "${topic.trim()}" — starting pipeline...`,
  };

  // ── AGENT 1: Researcher ─────────────────────────────────
  yield { type: "agent_start", agent: "researcher", task: `Search web for: "${topic.trim()}"` };

  let research: string;
  try {
    research = await researcherAgent(topic.trim(), apiKey, tavilyKey);
    yield {
      type: "agent_done",
      agent: "researcher",
      preview: research.slice(0, 180) + "...",
    };
  } catch (err) {
    yield { type: "error", message: `Researcher failed: ${err instanceof Error ? err.message : err}` };
    return;
  }

  // ── AGENT 2: Analyst ────────────────────────────────────
  yield { type: "agent_start", agent: "analyst", task: "Extract key insights from research" };

  let insights: string;
  try {
    insights = await analystAgent(topic.trim(), research, apiKey);
    yield {
      type: "agent_done",
      agent: "analyst",
      preview: insights.slice(0, 180) + "...",
    };
  } catch (err) {
    yield { type: "error", message: `Analyst failed: ${err instanceof Error ? err.message : err}` };
    return;
  }

  // ── AGENT 3: Writer ─────────────────────────────────────
  yield { type: "agent_start", agent: "writer", task: "Write final report from insights" };

  let report: string;
  try {
    report = await writerAgent(topic.trim(), insights, apiKey);
    yield {
      type: "agent_done",
      agent: "writer",
      preview: report.slice(0, 180) + "...",
    };
  } catch (err) {
    yield { type: "error", message: `Writer failed: ${err instanceof Error ? err.message : err}` };
    return;
  }

  // ── Orchestrator combines everything ────────────────────
  yield {
    type: "orchestrator",
    message: "All agents complete — compiling final report...",
  };

  yield { type: "final_report", report };
}
