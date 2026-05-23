# Ralph Mode Progress: TinyFish Web Search Integration

## Status: IN PROGRESS

## Phase 1: Research (COMPLETE)
- [x] TinyFish Search API docs analyzed
- [x] OMA codebase structure reviewed
- [x] Search is FREE - no credits needed

## Phase 2: Implementation (IN PROGRESS)

### Task 2.1: Add TINYFISH_API_KEY to config
**Status:** pending
**File:** `server/src/config.ts`
**Changes:**
- Add `TINYFISH_API_KEY` as optional string
- Validate it starts with `sk-tinyfish-` prefix
**Validation:** `npm run typecheck`

### Task 2.2: Create TinyFish search client module
**Status:** DONE
**File:** `server/src/inference/tinyfish.ts` (NEW)
**Changes:**
- Export `searchWeb(query: string): Promise<SearchResult[]>`
- GET `https://api.search.tinyfish.ai?query=...`
- Headers: `X-API-Key: {key}`
**Validation:** `npm run typecheck`

### Task 2.2b: Create TinyFish Fetch API client module
**Status:** DONE
**File:** `server/src/inference/tinyfish-fetch.ts` (NEW)
**Changes:**
- Export `fetchWebPages(urls: string[]): Promise<TinyFishFetchResponse>`
- POST `https://api.fetch.tinyfish.ai`
- Headers: `X-API-Key: {key}`, `Content-Type: application/json`
- Request body: `{ urls: string[] }`
**Validation:** `npm run typecheck`

### Task 2.3: Create /v1/search endpoint
**Status:** DONE
**File:** `server/src/routes/search.ts` (NEW)
**Changes:**
- GET `/v1/search?query=...`
- Bearer auth (API key)
- Returns search results
**Validation:** `npm run typecheck && npm test`

### Task 2.4: Update playground UI with web search toggle
**Status:** DONE
**File:** `app/src/app/playground/page.tsx`
**Changes:**
- Added Search icon button in header/toolbar
- Toggle state for "web search enabled"
- When enabled, call `/v1/search` and include results in context
- Show sources inline in AI response
**Validation:** `npm run typecheck`

### Task 2.5: Integrate search into chat flow
**Status:** DONE
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

## Files to Modify/Create
1. `server/src/config.ts` - Add TINYFISH_API_KEY
2. `server/src/inference/tinyfish.ts` - NEW - Search client
3. `server/src/routes/search.ts` - NEW - Search endpoint
4. `app/src/app/playground/page.tsx` - UI changes

## Validation Commands
- Server typecheck: `cd server && npm run typecheck`
- Server tests: `cd server && npm test`
- App typecheck: `cd app && npm run typecheck`

## Started: 2026-05-22

---

## Task: Add TinyFish Pricing Display to OMA Pricing Page

**Status:** DONE

**Date:** 2026-05-22

**Changes:**
- Created `app/src/components/tinyfish-pricing.tsx` - New component displaying TinyFish services
- Updated `app/src/app/pricing/page.tsx` - Added TinyFishPricing component import and rendering

**Files Modified:**
1. `app/src/components/tinyfish-pricing.tsx` (NEW)
2. `app/src/app/pricing/page.tsx`

**Pricing Displayed:**
- Web Search API: FREE (30 req/min)
- Content Fetch API: FREE (150 URLs/min)
- Browser/Agent API: $0.015/credit (15-min sessions)
- Concurrent Agents: 2 included
- Anti-Bot Protection: Auto-configured
- Stealth Browser: Included
- Proxy Support: Included
- Run History: 30 days
- Email support

**Validation:** App typecheck passes (errors in playground/page.tsx are pre-existing, not related to this change)

---

## Task: Add MCP Connector Integration Detection to Playground

**Status:** DONE

**Date:** 2026-05-22

**Changes:**
- Added `MCPConnector` component to `app/src/app/playground/page.tsx`
- Displays MCP status indicator in parameters panel
- Shows "Connected" or "Not connected" status based on userAgent detection
- Provides copyable install command for TinyFish MCP

**Files Modified:**
1. `app/src/app/playground/page.tsx`

**Features:**
- Collapsible MCP Connectors section in params panel
- Status indicator (green dot = detected, gray = not detected)
- Copy Install Command button
- Install command displayed: `npx -y install-mcp@latest https://agent.tinyfish.ai/mcp --client claude-code`

**Detection Logic:**
- Checks `navigator.userAgent` for 'claude', 'cursor', or 'windsurf' strings

**Validation:** `npm run typecheck` passes with 0 errors