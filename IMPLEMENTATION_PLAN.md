# Implementation Plan: TinyFish Web Search Integration

## Status: IN PROGRESS

## Phase 1: Research (COMPLETE)
- [x] TinyFish Search API docs analyzed
- [x] OMA codebase structure reviewed  
- [x] Search is FREE - no credits needed
- [x] API endpoint: `GET https://api.search.tinyfish.ai?query=...`
- [x] Auth: `X-API-Key` header
- [x] Response: `{ query, results: [{position, site_name, title, snippet, url}], total_results, page }`

## Phase 2: Implementation Tasks

### Task 2.1: Add TINYFISH_API_KEY to config
**Status:** pending
**File:** `server/src/config.ts`
**Changes:**
- Add `TINYFISH_API_KEY` as optional string
**Validation:** `cd server && npm run typecheck`

### Task 2.2: Create TinyFish search client module
**Status:** pending
**File:** `server/src/inference/tinyfish.ts` (NEW)
**Changes:**
- Export `searchWeb(query: string): Promise<SearchResult[]>`
- GET `https://api.search.tinyfish.ai?query=...`
- Headers: `X-API-Key: {key}`
**Validation:** `cd server && npm run typecheck`

### Task 2.3: Create /v1/search endpoint
**Status:** pending
**File:** `server/src/routes/search.ts` (NEW)
**Changes:**
- GET `/v1/search?query=...`
- Bearer auth (API key)
- Returns search results
**Validation:** `cd server && npm run typecheck && npm test`

### Task 2.4: Update playground UI with web search toggle
**Status:** pending
**File:** `app/src/app/playground/page.tsx`
**Changes:**
- Add Search icon button in header/toolbar  
- Toggle state for "web search enabled"
- When enabled, call `/v1/search` and include results in context
- Show sources inline in AI response
**Validation:** `cd app && npm run typecheck`

### Task 2.5: Integrate search into chat flow
**Status:** pending
**File:** `app/src/app/playground/page.tsx`
**Changes:**
- Before sending message, if web search enabled:
  1. Call `/v1/search?query={user_message}`
  2. Format results as context
  3. Prepend to messages array as system context
- Display sources as expandable section
**Validation:** Manual test in browser

## Backlog
- [ ] Add source citations to response
- [ ] Error handling for search failures
- [ ] Debounce/throttle search calls

## Validation Commands
- Server typecheck: `cd oma/server && npm run typecheck`
- Server tests: `cd oma/server && npm test`
- App typecheck: `cd oma/app && npm run typecheck`

## Started: 2026-05-22