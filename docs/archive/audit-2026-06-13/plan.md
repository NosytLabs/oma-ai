# Audit Mission: OMA-AI Comprehensive Visual + Code Audit

## Critical Points
- [ ] CP1: Capture fresh screenshots of all 18 pages on http://localhost:3000/
- [ ] CP2: Capture console errors/warnings per page
- [ ] CP3: Capture network failures (4xx/5xx) per page
- [ ] CP4: Capture accessibility tree (a11y snapshot) for landing + dashboard
- [ ] CP5: Identify section §05 missing on landing page (currently goes §04 → §06)
- [ ] CP6: Identify "BUILD" / "DEV" text fragmentation in masthead
- [ ] CP7: Identify CSS preload warning (565c18e39021cd06.css)
- [ ] CP8: Auth-gated pages: verify AuthNotice UX on /playground, /dashboard, /deposit, /settings, /admin

## Pages to Capture
1. / (landing)
2. /models
3. /pricing
4. /playground (auth required, expects redirect)
5. /dashboard (auth required)
6. /dashboard/api-keys (auth required)
7. /dashboard/credits (auth required)
8. /deposit (auth required)
9. /docs
10. /settings (auth required)
11. /admin (auth required)
12. /compare/surplus-min-discount-routing
13. /about
14. /faq
15. /privacy
16. /terms
17. /image-generation
18. /video-generation

## Output Locations
- Screenshots: /Users/tyson/Desktop/Code/OMA-AI/.opencode/audit-2026-06-13/final_runs/run_001/screenshots/
- Console log: /Users/tyson/Desktop/Code/OMA-AI/.opencode/audit-2026-06-13/final_runs/run_001/final_script_log.txt
- Also copy to: /tmp/oma-screenshots/ for the user to view
