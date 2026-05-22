# OMA AI Gateway - Task Master List

**Project:** OMA AI Gateway (oma-ai.com)  
**UI/UX Direction:** Vibrant & Uplifting Light Mode (Perplexity-inspired)  
**Theme:** Bright, premium consumer-grade with indigo (#6366f1) + rose (#f43f5e) accents  
**Background:** #fafafa (warm off-white) | **Surface:** #ffffff | **Text:** #09090b  
**Fonts:** Syne (headings), Inter (body)  
**Status:** Post-pivot, implementing refinements

---

## PART 1: VISUAL DESIGN COMPLIANCE

### Priority 1: Stake Page Terminal Aesthetic Removal
**Why Critical:** The stake page (`/stake`) still uses heavy `font-mono` className and terminal-style labels ("CONNECT WALLET", "STAKE OMA", "AUTHENTICATE", etc.) which clashes with the Perplexity-inspired bright theme.

**Tasks:**
- [ ] Replace `font-mono` className with Inter body font on stake page
- [ ] Change "CONNECT WALLET" header to "Connect Your Wallet"
- [ ] Change "AUTHENTICATE TO ACCESS OMA STAKING" to "Sign in to access OMA staking"
- [ ] Update tier cards to use rounded-xl instead of terminal-style boxes
- [ ] Replace all `mono` text classes with standard Syne/Inter typography
- [ ] Remove "20-DAY COOLDOWN" badge styling (keep functionality, update visuals)
- [ ] Update "UNSTAKE ALL" button to use btn-primary/btn-secondary system
- [ ] Clean up revenue distribution section - use card-glow consistently
- [ ] Ensure "PLATINUM ELITE" section uses badge system, not uppercase mono
- [ ] Test stake flow: connect -> stake amount -> verify tier update

### Priority 2: Dashboard Visual Audit
**Files:** `app/src/app/dashboard/page.tsx`
**Status:** Previously cleaned (from tasks.md), but needs verification

**Tasks:**
- [ ] Verify "CONNECT WALLET" -> "Connect Your Wallet" applied
- [ ] Verify "Authenticate to access..." -> "Sign in to view your account..."
- [ ] Check all buttons use btn-primary/btn-secondary system
- [ ] Ensure no leftover `font-mono` usage in body text
- [ ] Confirm cards use `card` class with `shadow-floating`
- [ ] Test: Connect wallet -> see dashboard with API key display

### Priority 3: Deposit Page Color System Migration
**Files:** `app/src/app/deposit/page.tsx`
**Issue:** Deposit page uses `--cyan` color token instead of `--accent` (indigo). This creates visual inconsistency.

**Tasks:**
- [ ] Audit all `text-cyan`, `bg-cyan`, `border-cyan` references in deposit page
- [ ] Replace with `text-accent`, `bg-accent`, `border-accent` (indigo system)
- [ ] Exception: Keep cyan for crypto-specific elements (wallet icons, etc.) where appropriate
- [ ] Update "Direct USDC" route card to use indigo instead of blue
- [ ] Update "Swap" route card to use rose for privacy mode toggle
- [ ] Verify coin selector uses consistent accent colors
- [ ] Test deposit flow: select USDC -> get quote -> execute deposit

### Priority 4: Global Font Consistency Audit
**Affected Files:** All pages using `font-mono` className

**Tasks:**
- [ ] Run grep: `font-mono` across all page files
- [ ] Identify legitimate uses (code blocks, API keys, addresses)
- [ ] Remove from: headings, body text, labels, buttons
- [ ] Keep in: terminal-style displays, code snippets, wallet addresses
- [ ] Update `globals.css` to ensure mono is available but not default

### Priority 5: Landing Page Hero Refinement
**Files:** `app/src/components/landing/Hero.tsx`
**Status:** Completed in previous pivot, verify alignment

**Tasks:**
- [ ] Verify chat preview shows realistic AI conversation (not terminal)
- [ ] Confirm CTAs use pill-shaped buttons (btn-primary)
- [ ] Check model selector pill in preview matches playground
- [ ] Verify empty state uses "What would you like to create?"
- [ ] Test: Click "Open Playground" -> should open /playground

---

## PART 2: PAGE-BY-PAGE AUDIT

### Page: `/` (Landing)
**Components:** Hero, HowItWorks, ModelHighlights, PricingPayments, ForDevelopers, CtaFooter

**Status:** Mostly complete, visual alignment done
**Tasks:**
- [ ] Verify all CTAs use rounded-full pill style
- [ ] Check gradient text uses indigo-to-rose
- [ ] Confirm shadows are soft (no hard borders)
- [ ] Test: Land -> Navbar visible -> All links work

### Page: `/playground`
**Status:** Complete (premium chat UI implemented)

**Tasks:**
- [ ] Verify model selector dropdown matches design
- [ ] Check sidebar slides in/out smoothly
- [ ] Confirm message bubbles use indigo for user, white for AI
- [ ] Test: Send message -> streaming response -> tokens displayed

### Page: `/swap`
**Status:** Complete (standalone swap page)

**Tasks:**
- [ ] Verify token selector with search works
- [ ] Check privacy mode toggle (Monero routing) is visible
- [ ] Confirm quote display before confirm
- [ ] Test: Select BTC -> USDC -> get quote -> confirm swap flow

### Page: `/dashboard`
**Status:** Previously cleaned

**Tasks:**
- [ ] Verify API key display uses monospace for key only
- [ ] Check "Refresh" button (not uppercase REFRESH)
- [ ] Confirm no terminal aesthetic remains
- [ ] Test: Connect wallet -> see API key, usage stats

### Page: `/deposit`
**Status:** Needs color migration (see Priority 3)

**Tasks:**
- [ ] Complete color system migration (cyan -> accent)
- [ ] Verify coin selector dropdown is consistent
- [ ] Check route comparison cards use card-glow
- [ ] Test: Select coin -> amount -> route detected -> deposit

### Page: `/stake`
**Status:** Needs terminal aesthetic removal (see Priority 1)

**Tasks:**
- [ ] Complete visual overhaul
- [ ] Verify staking tiers display correctly
- [ ] Check progress bar to next tier
- [ ] Test: Connect -> stake OMA -> verify tier upgrade

### Page: `/models`
**Status:** Complete (model cards with pricing)

**Tasks:**
- [ ] Verify filter bar categories work
- [ ] Check model cards use card-glow consistently
- [ ] Confirm pricing table is readable
- [ ] Test: Filter by "Coding" -> shows coding models only

### Page: `/pricing`
**Status:** Complete (pricing table with staking discounts)

**Tasks:**
- [ ] Verify category tabs filter correctly
- [ ] Check staking discount badges display
- [ ] Confirm credits & billing section is clear
- [ ] Test: Select "Frontier" -> shows frontier models

### Page: `/docs`
**Status:** Complete (API documentation)

**Tasks:**
- [ ] Verify sidebar navigation highlights active section
- [ ] Check code blocks use syntax highlighting
- [ ] Confirm copy button works on all code examples
- [ ] Test: Click "Authentication" -> scrolls to section

### Page: `/settings`
**Status:** Complete (account settings)

**Tasks:**
- [ ] Verify wallet unlink flow works
- [ ] Check session management displays correctly
- [ ] Confirm danger zone styling (red border)
- [ ] Test: Unlink EVM wallet -> should disconnect

---

## PART 3: USER FLOWS

### Flow 1: Onboarding (New User)
```
Landing Page (/):
  -> Click "Get API Key" or "Connect Wallet"
  -> Redirect to /dashboard
  -> Connect wallet modal (wagmi)
  -> Sign SIWE message
  -> API key generated and displayed
  -> User copies key (one-time display)
  -> Can now use playground or API
```

**Tasks:**
- [ ] Verify "Get API Key" button in navbar works
- [ ] Confirm wallet connection modal appears
- [ ] Check API key is displayed once and stored
- [ ] Verify key persists in localStorage
- [ ] Test: New user lands -> connects wallet -> gets key

### Flow 2: Chat Interaction (Playground)
```
/playground:
  -> User types message in input
  -> Press Enter or click send
  -> If no API key: prompt to enter or connect
  -> If API key: send to /v1/chat/completions
  -> Stream response token by token
  -> Display tokens used and latency
  -> Message appears in chat history
```

**Tasks:**
- [ ] Verify anonymous chat allowed (no key required to try)
- [ ] Check API key sidebar saves to localStorage
- [ ] Confirm streaming works (SSE)
- [ ] Verify token count and latency displayed
- [ ] Test: Enter message -> get streaming response

### Flow 3: Deposit Funds
```
/deposit:
  -> Connect wallet (if not connected)
  -> Select cryptocurrency (USDC, ETH, OMA, BTC, etc.)
  -> Enter amount
  -> Route auto-detected (direct/swap/stake)
  -> View quote with fees and estimated credits
  -> Click "Deposit Now"
  -> For USDC: wallet approve -> transfer -> confirm
  -> For swap: get HoudiniSwap address -> send crypto
  -> Credits issued after settlement
  -> Redirect to /dashboard
```

**Tasks:**
- [ ] Verify coin selector shows popular coins first
- [ ] Check route detection is automatic
- [ ] Confirm quote shows fees and credits estimate
- [ ] Verify USDC direct deposit works (approve + transfer)
- [ ] Test: Deposit $10 USDC -> credits appear

### Flow 4: Crypto Swap
```
/swap:
  -> Connect wallet (if not connected)
  -> Select "From" token (e.g., BTC)
  -> Select "To" token (e.g., USDC)
  -> Enter amount
  -> Click "Get Quote"
  -> View quote with fees, slippage
  -> Click "Confirm Swap"
  -> Execute via HoudiniSwap
  -> Receive confirmation with tx hash
  -> Funds go directly to wallet (not OMA credits)
```

**Tasks:**
- [ ] Verify token search works
- [ ] Check quote shows all fees clearly
- [ ] Confirm swap executes correctly
- [ ] Verify privacy mode toggle works
- [ ] Test: Swap BTC -> USDC -> USDC in wallet

### Flow 5: Stake OMA
```
/stake:
  -> Connect wallet (if not connected)
  -> View current tier and staked amount
  -> Enter OMA amount to stake
  -> See preview: new total, new tier
  -> Click "Stake OMA"
  -> Approve OMA token (if first time)
  -> Execute stake transaction
  -> See updated staked amount and tier
  -> Tier discount applied to inference
```

**Tasks:**
- [ ] Verify stake input validation
- [ ] Check tier preview shows correctly
- [ ] Confirm approval transaction works
- [ ] Verify cooldown period displayed for unstake
- [ ] Test: Stake 1000 OMA -> Bronze tier -> 3% discount

---

## PART 4: INTEGRATION & TESTING

### Backend Integration Testing
**Server:** `oma/server` on port 3001

**Tasks:**
- [ ] Test `POST /auth/nonce` - returns valid nonce
- [ ] Test `POST /auth/wallet` - signs message, returns API key
- [ ] Test `POST /v1/chat/completions` - returns OpenAI-compatible response
- [ ] Test `GET /v1/models` - returns 50+ models
- [ ] Test `POST /x402/verify` - verifies payment signatures
- [ ] Test deposit endpoints - USDC, OMA, HoudiniSwap
- [ ] Run server tests: `npm test` (116 tests)
- [ ] Verify TypeScript: `npm run typecheck` (0 errors)
- [ ] Verify Lint: `npm run lint` (0 errors)

### Frontend Build Testing
**App:** `oma/app` on port 3000

**Tasks:**
- [ ] Run dev server: `npm run dev` (no crashes)
- [ ] Run production build: `npm run build` (no errors)
- [ ] Run TypeScript check: `npx tsc --noEmit` (0 errors)
- [ ] Test all pages render without console errors
- [ ] Verify no broken images or missing fonts
- [ ] Test mobile view (responsive breakpoints)

### Docker Build Testing
**Tasks:**
- [ ] Build server Docker: `docker build -f server/Dockerfile .`
- [ ] Build app Docker: `docker build -f app/Dockerfile .`
- [ ] Run docker-compose: `docker compose up -d`
- [ ] Verify health endpoint: `curl localhost:3001/health`
- [ ] Check logs for errors

---

## PART 5: DESIGN SYSTEM COMPLIANCE

### Design Tokens (from globals.css)
```css
--color-void: #fafafa          /* Background */
--color-surface: #ffffff        /* Cards/panels */
--color-accent: #6366f1         /* Primary - Indigo */
--color-secondary: #f43f5e     /* Secondary - Rose */
--color-success: #10b981       /* Green */
--color-text: #09090b          /* Primary text */
--color-text-secondary: #71717a /* Secondary text */
--color-border: #e4e4e7         /* Borders */
--shadow-soft: 0 4px 24px -4px rgba(0,0,0,0.05)
--shadow-floating: 0 8px 32px -8px rgba(0,0,0,0.08)
--shadow-glow: 0 0 24px rgba(99,102,241,0.15)
```

### Component Checklist
- [ ] Cards: Use `card` class with `shadow-floating`
- [ ] Buttons: Use `btn-primary` (indigo) or `btn-secondary` (white)
- [ ] Badges: Use `badge` with `badge--accent`, `badge--success`
- [ ] Inputs: Clean rounded-xl with soft shadow on focus
- [ ] Shadows: Soft diffused, no hard borders
- [ ] Animations: Use stagger-children for entrance animations
- [ ] Fonts: Syne for headings, Inter for body, mono for code/addresses

### Things to Avoid
- [ ] Emoji anywhere (use text/ASCII only)
- [ ] Terminal-style text (uppercase mono labels)
- [ ] Hard borders (use soft shadows instead)
- [ ] Dark theme remnants (should be all light now)
- [ ] Inconsistent color tokens (cyan vs accent)

---

## PART 6: KNOWN ISSUES & TECHNICAL DEBT

### High Priority
- [ ] Stake page terminal aesthetic removal (blocks premium feel)
- [ ] Deposit page color migration (cyan -> accent)
- [ ] Font consistency (remove mono from body text)

### Medium Priority
- [ ] Mobile responsiveness verification (all pages)
- [ ] Performance audit (lazy loading, bundle size)
- [ ] Real API integration testing (not just mock)

### Low Priority
- [ ] WebSocket notifications for real-time settlement (Phase 2)
- [ ] Analytics dashboard (Phase 2)
- [ ] CCTP integration for native USDC bridging (Phase 2)

### Already Completed (Verify Still Intact)
- [ ] Global light theme (globals.css)
- [ ] Navbar with Swap link
- [ ] Hero section with chat preview
- [ ] Playground premium chat UI
- [ ] Dashboard cleaned of terminal jargon
- [ ] Swap page standalone
- [ ] Models page with cards
- [ ] Pricing page with table
- [ ] Docs page with navigation
- [ ] Settings page with wallet management

---

## QUICK START COMMANDS

```bash
# Development
cd oma
./start-dev.sh

# Server (port 3001)
cd server && npm run dev

# App (port 3000)
cd app && npm run dev

# Testing
cd server && npm test           # 116 tests
cd server && npm run typecheck  # 0 errors
cd server && npm run lint        # 0 errors

cd app && npx tsc --noEmit      # 0 errors

# Docker
docker compose build --no-cache
docker compose up -d

# Health check
curl localhost:3001/health
```

---

## FILE REFERENCE

### Key Files
| File | Purpose |
|------|---------|
| `oma/tasks.md` | This file - task master list |
| `oma/README.md` | Project overview and quick start |
| `oma/AGENTS.md` | Development commands and validation gates |
| `docs/OMA-ARCHITECTURE.md` | System design and components |
| `docs/OMA-PHASE-2-PLAN.md` | Future features (staking, CCTP) |
| `app/src/app/globals.css` | Design tokens and global styles |
| `app/src/components/navbar.tsx` | Navigation with Swap link |

### Pages (app/src/app/)
| Page | Status | Priority |
|------|--------|----------|
| `/` (page.tsx) | Complete | Low |
| `/playground` | Complete | Low |
| `/swap` | Complete | Low |
| `/dashboard` | Complete | Medium |
| `/deposit` | Needs color fix | High |
| `/stake` | Needs overhaul | Critical |
| `/models` | Complete | Low |
| `/pricing` | Complete | Low |
| `/docs` | Complete | Low |
| `/settings` | Complete | Low |

---

*Last updated: May 2026*  
*Theme: Vibrant Light (Perplexity-inspired)*  
*Stack: Next.js 15, Hono.js, wagmi, Venice AI, Neon PostgreSQL*