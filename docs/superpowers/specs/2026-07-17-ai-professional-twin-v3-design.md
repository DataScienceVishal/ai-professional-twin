# AI Professional Twin - V3 Design Specification

**Date**: 2026-07-17
**Status**: Draft
**Author**: Vishal Khan + Claude (Architect)
**Builds on**: V2 spec at `docs/superpowers/specs/2026-07-11-ai-professional-twin-v2-design.md`

---

## 1. Vision

V3 transforms the AI Twin from a RAG chatbot into an agentic AI system. The LLM gains the ability to call tools (fetch live GitHub data, calculate portfolio stats), route questions through a LangGraph workflow (classify then retrieve differently), and users get persistent conversation history in the browser. These features demonstrate production AI engineering patterns that go beyond basic RAG.

**Success metric**: An interviewer asks "How does your system handle complex queries?" and Vishal can explain query classification, multi-strategy retrieval, and tool-augmented generation with a live demo.

---

## 2. Constraints

All V2 constraints still apply:

| Constraint | Value |
|-----------|-------|
| Budget | $0/month - free tiers only |
| LLM Provider | GitHub Models (GPT-4.1-mini) - supports tool calling |
| New dependencies | LangGraph (backend), no new frontend deps |
| Backward compatibility | All V2 features continue working unchanged |

---

## 3. Feature 1: Tool Calling

### 3.1 Overview

The LLM can invoke Python functions during a conversation to fetch live data or perform calculations. Tools are defined with OpenAI-format schemas and registered with the LLM client. When the LLM decides to call a tool, the backend executes it, feeds the result back, and the LLM incorporates it into its response.

### 3.2 Tools

**GitHub tools** (wrap existing `GitHubAPIService`):

| Tool | Description | Parameters |
|------|------------|------------|
| `search_repos` | Search Vishal's GitHub repos by keyword or language | `query: str`, `language: str (optional)` |
| `get_repo_stats` | Get stars, forks, commit count, last updated for a repo | `repo_name: str` |
| `get_recent_activity` | Get Vishal's most recent GitHub commits/pushes | `days: int (default 7)` |

**Portfolio tools** (compute from knowledge base):

| Tool | Description | Parameters |
|------|------------|------------|
| `calculate_experience` | Calculate total years of professional experience | none |
| `count_projects_by_category` | Count projects grouped by category (AI, ML, Data) | none |
| `get_skill_summary` | Get skills organized by proficiency level | `category: str (optional)` |

**Action tools**:

| Tool | Description | Parameters |
|------|------------|------------|
| `get_resume_download_link` | Return the URL to download Vishal's resume PDF | none |
| `generate_comparison_table` | Generate a markdown comparison table | `items: list[str]`, `criteria: list[str]` |

### 3.3 Architecture

```
User Query
    |
    v
[LLM with tools param]
    |
    +--> Regular text response --> stream to client
    |
    +--> Tool call detected
            |
            v
         [Execute tool function]
            |
            v
         [Feed result back to LLM]
            |
            v
         [LLM generates response using tool result]
            |
            v
         Stream to client
```

### 3.4 Implementation

**New module: `backend/app/tools/`**

- `__init__.py` - Tool registry: maps tool names to functions + schemas
- `github_tools.py` - GitHub tool implementations (uses `GitHubAPIService`)
- `portfolio_tools.py` - Portfolio calculation tools (reads from ChromaDB/knowledge)
- `action_tools.py` - Action tools (resume link, comparison table)
- `schemas.py` - OpenAI-format tool definitions (JSON schemas)

**Modified files:**

- `services/llm.py` - Add `tools` parameter to `stream()` and `chat()`. Handle `tool_calls` in the streaming response. Implement the tool-call loop: detect tool call -> execute -> feed result back -> continue.
- `routers/chat.py` - Pass tool definitions and tool executor to the LLM service. Stream tool execution status as SSE events so the frontend can show "Searching GitHub repos..." indicators.
- `main.py` - Initialize tool registry with dependencies (GitHubAPIService, ChromaStore) during lifespan.

**New SSE event types:**

```json
{"type": "tool_start", "tool": "search_repos", "args": {"query": "RAG"}}
{"type": "tool_result", "tool": "search_repos", "summary": "Found 3 repos"}
{"type": "chunk", "content": "Based on the search results..."}
```

**Frontend changes:**

- `lib/types.ts` - Add `tool_start` and `tool_result` SSE event types
- `hooks/use-chat.ts` - Handle new event types, store tool activity
- `components/chat/message.tsx` - Show tool usage indicators (small "Used: search_repos" badges below the message, similar to source citations)

### 3.5 Tool Execution Safety

- Tools are read-only. No tool can modify state.
- Tool execution has a 10-second timeout.
- Maximum 3 tool calls per request to prevent runaway loops.
- Tool results are truncated to 2000 characters before feeding back to LLM.

---

## 4. Feature 2: LangGraph Smart Routing

### 4.1 Overview

Replace the current linear flow (classify by keywords -> retrieve -> generate) with a LangGraph `StateGraph` that classifies the query type and routes to the optimal retrieval strategy. This is a significant upgrade over the keyword-based `QueryClassifier` in `retriever.py`.

### 4.2 Query Types

| Type | Description | Retrieval Strategy |
|------|------------|-------------------|
| `factual` | Single-topic questions ("What's his GPA?", "Where does he work?") | Standard single-query RAG (current behavior) |
| `comparison` | Multi-topic questions ("Compare his ML and data engineering experience") | Split into sub-queries, retrieve each, merge context |
| `technical` | Deep technical questions ("Explain his RAG architecture") | RAG with higher top_k (8 instead of 5) for more context depth |
| `meta` | Questions about the app itself ("How does this chatbot work?") | No RAG - answer from system prompt about the app's architecture |

**Note:** Tool calling is always available regardless of query type. The LLM decides when to use tools based on the conversation. The routing only affects the retrieval strategy.

### 4.3 LangGraph Workflow

```
                    [START]
                       |
                       v
                 [classify_query]
                  LLM classifies the
                  query into a type
                       |
          +------------+------------+-----------+
          |            |            |           |
          v            v            v           v
     [factual]   [comparison]  [technical]  [meta]
     Standard     Split into    RAG with    Direct
     RAG query    sub-queries   higher      answer
          |        retrieve      top_k        |
          |        each, merge      |         |
          v            v            v         v
                 [generate_response]
                  LLM generates final
                  answer with context
                       |
                       v
                    [END]
```

### 4.4 Implementation

**New module: `backend/app/workflows/`**

- `__init__.py` - Empty package marker
- `router_graph.py` - LangGraph `StateGraph` definition with nodes: `classify_query`, `factual_retrieve`, `comparison_retrieve`, `technical_retrieve`, `meta_respond`, `generate_response`
- `state.py` - TypedDict for graph state: `query`, `query_type`, `sub_queries`, `rag_context`, `sources`, `tools_enabled`, `messages`

**How classification works:**

The `classify_query` node uses a lightweight LLM call (same gpt-4.1-mini) with a structured output prompt:

```
Classify this user query into exactly one type:
- factual: asking about a single topic (education, experience, skills, specific project)
- comparison: comparing two or more topics or asking for breadth across areas
- technical: asking about architecture, implementation details, or how something was built
- meta: asking about this chatbot/app itself, how it works, or what it can do

Query: "{query}"
Type:
```

This replaces the keyword-based `QueryClassifier` in `retriever.py`. The existing `Retriever` class stays as-is but gets called by the graph nodes instead of directly by the chat router.

**Comparison retrieval strategy:**

The `comparison_retrieve` node:
1. Uses LLM to split the query into 2-3 sub-queries
2. Runs each sub-query through the existing `Retriever.retrieve()`
3. Merges and deduplicates the results
4. Prefixes each section with the sub-query topic for context

**Modified files:**

- `routers/chat.py` - Call the LangGraph workflow instead of directly calling `retriever.retrieve()` + `llm.stream()`. The workflow returns the retrieval context and metadata (query type, sub-queries used), which get included in SSE events.
- `main.py` - Initialize the workflow graph during lifespan, passing in retriever, LLM service, and tool registry.

**New SSE event type:**

```json
{"type": "routing", "query_type": "comparison", "sub_queries": ["ML experience", "data engineering experience"]}
```

**Frontend changes:**

- `lib/types.ts` - Add `routing` event type
- `hooks/use-chat.ts` - Handle routing event
- `components/chat/message.tsx` - Optionally show routing info (small "Query type: comparison" indicator)

---

## 5. Feature 3: Conversation History (localStorage)

### 5.1 Overview

Users can resume previous conversations. Sessions are stored in the browser's localStorage, keyed by a generated session ID. The sidebar shows a list of past sessions. No backend changes needed - the frontend already sends the full message array with each request.

### 5.2 Data Model

```typescript
interface ChatSession {
  id: string           // crypto.randomUUID()
  title: string        // First user message, truncated to 50 chars
  mode: ChatMode
  messages: Message[]
  createdAt: number    // Date.now()
  updatedAt: number
}
```

Storage key: `ai-twin-sessions`
Max sessions stored: 20 (oldest auto-pruned when exceeded)
Max total storage: ~5MB (localStorage limit) - each session ~10-50KB

### 5.3 Implementation

**New file: `frontend/src/lib/storage.ts`**

Utility functions:
- `loadSessions(): ChatSession[]` - Load all sessions from localStorage
- `saveSession(session: ChatSession): void` - Save/update a session
- `deleteSession(id: string): void` - Delete a session
- `pruneOldSessions(maxCount: number): void` - Remove oldest sessions beyond limit

**Modified files:**

- `hooks/use-chat.ts` - On each message exchange, auto-save the current session to localStorage. Generate a session ID on first message. Load a session when the user selects one from history.
- `components/layout/sidebar.tsx` - Add "History" section below the mode switcher showing recent sessions (title + timestamp). Click to load, swipe/button to delete. "New Chat" button at the top.
- `components/layout/header.tsx` - Add "New Chat" button for mobile view.

### 5.4 UX Flow

1. User opens the app - empty chat (new session)
2. User sends first message - session auto-created with title = first message
3. User continues chatting - session auto-saved after each exchange
4. User clicks "New Chat" - starts a fresh session, previous is saved
5. User clicks a history item - loads that session's messages and mode
6. User clicks delete on a history item - removes from localStorage

---

## 6. File Map Summary

### New Files

| File | Responsibility |
|------|---------------|
| `backend/app/tools/__init__.py` | Tool registry |
| `backend/app/tools/github_tools.py` | GitHub tool implementations |
| `backend/app/tools/portfolio_tools.py` | Portfolio calculation tools |
| `backend/app/tools/action_tools.py` | Action tools |
| `backend/app/tools/schemas.py` | OpenAI-format tool definitions |
| `backend/app/workflows/__init__.py` | Package marker |
| `backend/app/workflows/router_graph.py` | LangGraph StateGraph |
| `backend/app/workflows/state.py` | Graph state TypedDict |
| `frontend/src/lib/storage.ts` | localStorage session management |
| `backend/tests/test_tools/` | Tests for all tools |
| `backend/tests/test_workflows/` | Tests for LangGraph workflow |

### Modified Files

| File | Changes |
|------|---------|
| `backend/app/services/llm.py` | Add tools param, tool-call loop |
| `backend/app/routers/chat.py` | Use workflow graph, stream tool/routing events |
| `backend/app/main.py` | Init tool registry + workflow graph |
| `backend/pyproject.toml` | Add `langgraph` dependency |
| `frontend/src/lib/types.ts` | New SSE event types |
| `frontend/src/hooks/use-chat.ts` | Handle new events, session persistence |
| `frontend/src/components/layout/sidebar.tsx` | History list, new chat button |
| `frontend/src/components/layout/header.tsx` | New chat button (mobile) |
| `frontend/src/components/chat/message.tsx` | Tool usage + routing indicators |

### Unchanged

The existing `Retriever`, `ChromaStore`, `EmbeddingService`, `chunker.py`, knowledge files, and all other V2 code remain unchanged. The workflow graph calls into the existing retriever - it doesn't replace it.

---

## 7. Dependency Changes

**Backend (pyproject.toml):**

```toml
[project]
dependencies = [
    # existing deps...
    "langgraph>=0.4",
]
```

No new frontend dependencies. localStorage is a browser API.

---

## 8. Testing Strategy

- **Tool tests**: Mock `GitHubAPIService` and `ChromaStore`, verify each tool returns expected format
- **Workflow tests**: Mock LLM classification responses, verify correct routing to retrieval strategies
- **Integration**: Verify the full flow: query -> classify -> route -> retrieve -> tool call -> generate
- **Frontend**: Manual testing of localStorage persistence, session switching, history UI

---

## 9. Out of Scope for V3

- Google Drive API integration (user will manually copy files to knowledge/)
- User authentication
- Feedback collection system
- Analytics dashboard
- Server-side conversation storage
- Voice input/output
