# AI Agents — Complete Guide

## What is an AI Agent?

An AI agent is a program that uses a large language model (LLM) to reason about a problem and take actions autonomously to solve it. Unlike a simple chatbot that just answers questions, an agent can use tools, search the web, write code, and complete multi-step tasks without human intervention at each step.

## The Agent Loop

Every agent runs on the same core loop:
1. Receive a task from the user
2. Think about what to do next
3. Call a tool if needed (search, calculator, file reader, etc.)
4. Read the tool result
5. Repeat until the task is done
6. Return the final answer

This loop is sometimes called the ReAct pattern (Reason + Act).

## Types of Agents

### Single Agent
One AI model with access to multiple tools. Good for most tasks. Simple to build and debug.

### Multi-Agent
Multiple AI models working together. One orchestrator delegates to specialist sub-agents. Better for complex tasks that need different expertise.

### RAG Agent
An agent that searches a private knowledge base before answering. Used when the AI needs access to private or domain-specific information not on the internet.

## Key Concepts

### Tool Use
Tools are functions the AI can call. The AI never runs them directly — it requests a tool call, your code runs it, and the result goes back to the AI. Common tools: web search, calculator, file reader, database query, API calls.

### System Prompt
A hidden instruction given to the AI before the conversation starts. It defines the agent's role, behavior, and constraints. The most important lever for controlling agent behavior.

### Memory
Agents have no built-in memory between sessions. Memory is implemented by saving conversation history to a file or database and loading it at the start of each session.

### Context Window
The maximum amount of text an AI can process at once. RAG works by selecting only the most relevant chunks of your documents to fit in the context window — you can't just dump everything in.
