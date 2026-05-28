from playwright.sync_api import sync_playwright, Page, expect
import time

def test_oma_frontend():
    """Test all major user flows on the OMA AI Gateway frontend."""
    
    results = {
        "pages": {},
        "errors": [],
        "warnings": []
    }
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 720})
        page = context.new_page()
        
        # Capture console messages
        console_errors = []
        page.on("console", lambda msg: console_errors.append(f"[{msg.type}] {msg.text}") if msg.type == "error" else None)
        
        # Base URL - using the running app
        base_url = "http://localhost:3001"
        
        print("\n" + "="*60)
        print("OMA AI GATEWAY - FRONTEND USER FLOW TESTS")
        print("="*60 + "\n")
        
        # Test 1: Landing Page
        print("TEST 1: Landing Page")
        print("-" * 40)
        try:
            page.goto(base_url, wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(2000)  # Wait for animations
            
            # Check page title
            title = page.title()
            print(f"  ✓ Page loaded: {title}")
            
            # Check hero section
            hero = page.locator("h1").first
            if hero.is_visible():
                hero_text = hero.text_content()
                print(f"  ✓ Hero visible: {hero_text[:50]}...")
            
            # Check navigation
            nav_links = page.locator("nav a").all()
            print(f"  ✓ Navigation links: {len(nav_links)} found")
            
            # Check status section
            if page.locator("text=live_routing").is_visible():
                print("  ✓ Status section visible")
            
            # Check model table
            if page.locator("table").is_visible():
                rows = page.locator("table tbody tr").all()
                print(f"  ✓ Model table: {len(rows)} models")
            
            # Check CTA buttons
            cta_buttons = page.locator("text=Get started").all()
            if cta_buttons:
                print(f"  ✓ CTA buttons: {len(cta_buttons)} found")
            
            results["pages"]["landing"] = {"status": "PASS", "title": title}
            page.screenshot(path="c:/tmp/oma-landing.png", full_page=True)
            print("  📸 Screenshot saved: oma-landing.png")
            
        except Exception as e:
            results["pages"]["landing"] = {"status": "FAIL", "error": str(e)}
            print(f"  ✗ Error: {e}")
        
        print()
        
        # Test 2: Pricing Page
        print("TEST 2: Pricing Page")
        print("-" * 40)
        try:
            page.goto(f"{base_url}/pricing", wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(1500)
            
            title = page.title()
            print(f"  ✓ Page loaded: {title}")
            
            # Check payment methods
            payment_methods = page.locator("text=USDC on Base").first
            if payment_methods.is_visible():
                print("  ✓ Payment methods section visible")
            
            # Check model categories
            categories = page.locator("button:has-text('Frontier'), button:has-text('Premium')").all()
            print(f"  ✓ Model categories: {len(categories)} buttons")
            
            # Check model table
            if page.locator("table").is_visible():
                model_rows = page.locator("table tbody tr").all()
                print(f"  ✓ Model table: {len(model_rows)} models")
            
            # Check FAQ section
            faq_items = page.locator("text=How do I add credits?").first
            if faq_items.is_visible():
                print("  ✓ FAQ section visible")
            
            results["pages"]["pricing"] = {"status": "PASS"}
            page.screenshot(path="c:/tmp/oma-pricing.png", full_page=True)
            print("  📸 Screenshot saved: oma-pricing.png")
            
        except Exception as e:
            results["pages"]["pricing"] = {"status": "FAIL", "error": str(e)}
            print(f"  ✗ Error: {e}")
        
        print()
        
        # Test 3: Models Page
        print("TEST 3: Models Page")
        print("-" * 40)
        try:
            page.goto(f"{base_url}/models", wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(1500)
            
            title = page.title()
            print(f"  ✓ Page loaded: {title}")
            
            # Check model cards
            model_cards = page.locator("[class*='card'], .group").all()
            print(f"  ✓ Model cards: {len(model_cards)} found")
            
            results["pages"]["models"] = {"status": "PASS"}
            page.screenshot(path="c:/tmp/oma-models.png", full_page=True)
            print("  📸 Screenshot saved: oma-models.png")
            
        except Exception as e:
            results["pages"]["models"] = {"status": "FAIL", "error": str(e)}
            print(f"  ✗ Error: {e}")
        
        print()
        
        # Test 4: Docs Page
        print("TEST 4: Docs Page")
        print("-" * 40)
        try:
            page.goto(f"{base_url}/docs", wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(1500)
            
            title = page.title()
            print(f"  ✓ Page loaded: {title}")
            
            # Check for documentation content
            doc_sections = page.locator("h1, h2").all()
            print(f"  ✓ Documentation sections: {len(doc_sections)} found")
            
            results["pages"]["docs"] = {"status": "PASS"}
            page.screenshot(path="c:/tmp/oma-docs.png", full_page=True)
            print("  📸 Screenshot saved: oma-docs.png")
            
        except Exception as e:
            results["pages"]["docs"] = {"status": "FAIL", "error": str(e)}
            print(f"  ✗ Error: {e}")
        
        print()
        
        # Test 5: Playground Page
        print("TEST 5: Playground Page")
        print("-" * 40)
        try:
            page.goto(f"{base_url}/playground", wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(1500)
            
            title = page.title()
            print(f"  ✓ Page loaded: {title}")
            
            # Check model selector
            model_selector = page.locator("[class*='select'], select").first
            if model_selector.is_visible():
                print("  ✓ Model selector visible")
            
            # Check message input
            input_area = page.locator("textarea, [placeholder*='message'], [placeholder*='prompt']").first
            if input_area.is_visible():
                print("  ✓ Message input visible")
            
            # Check settings button
            settings = page.locator("button:has-text('Settings'), [aria-label*='Settings']").first
            if settings.is_visible():
                print("  ✓ Settings button visible")
            
            results["pages"]["playground"] = {"status": "PASS"}
            page.screenshot(path="c:/tmp/oma-playground.png", full_page=True)
            print("  📸 Screenshot saved: oma-playground.png")
            
        except Exception as e:
            results["pages"]["playground"] = {"status": "FAIL", "error": str(e)}
            print(f"  ✗ Error: {e}")
        
        print()
        
        # Test 6: Dashboard (without wallet)
        print("TEST 6: Dashboard Page (unauthenticated)")
        print("-" * 40)
        try:
            page.goto(f"{base_url}/dashboard", wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(1500)
            
            title = page.title()
            print(f"  ✓ Page loaded: {title}")
            
            # Should show wallet connection view
            connect_btn = page.locator("button:has-text('Connect'), [aria-label*='Connect']").first
            if connect_btn.is_visible():
                print("  ✓ Wallet connect prompt visible (expected for unauthenticated)")
            
            results["pages"]["dashboard"] = {"status": "PASS"}
            page.screenshot(path="c:/tmp/oma-dashboard.png", full_page=True)
            print("  📸 Screenshot saved: oma-dashboard.png")
            
        except Exception as e:
            results["pages"]["dashboard"] = {"status": "FAIL", "error": str(e)}
            print(f"  ✗ Error: {e}")
        
        print()
        
        # Test 7: Use Cases Pages
        print("TEST 7: Use Cases Pages")
        print("-" * 40)
        try:
            for use_case in ["ai-agents", "apps", "chatbots"]:
                page.goto(f"{base_url}/use-cases/{use_case}", wait_until="networkidle", timeout=30000)
                page.wait_for_timeout(500)
                heading = page.locator("h1").first.text_content()
                print(f"  ✓ /use-cases/{use_case}: {heading[:40]}...")
            
            results["pages"]["use-cases"] = {"status": "PASS"}
            
        except Exception as e:
            results["pages"]["use-cases"] = {"status": "FAIL", "error": str(e)}
            print(f"  ✗ Error: {e}")
        
        print()
        
        # Test 8: Compare Pages
        print("TEST 8: Compare Pages")
        print("-" * 40)
        try:
            for alt in ["venice-ai-alternative", "openrouter-alternative", "cheaptokens-alternative"]:
                page.goto(f"{base_url}/compare/{alt}", wait_until="networkidle", timeout=30000)
                page.wait_for_timeout(500)
                heading = page.locator("h1").first.text_content()
                print(f"  ✓ /compare/{alt}: {heading[:40]}...")
            
            results["pages"]["compare"] = {"status": "PASS"}
            
        except Exception as e:
            results["pages"]["compare"] = {"status": "FAIL", "error": str(e)}
            print(f"  ✗ Error: {e}")
        
        print()
        
        # Test 9: Other Pages
        print("TEST 9: Other Pages")
        print("-" * 40)
        other_pages = [
            ("/crypto-payments", "Crypto Payments"),
            ("/image-generation", "Image Generation"),
            ("/video-generation", "Video Generation"),
            ("/privacy", "Privacy"),
            ("/terms", "Terms"),
        ]
        
        for path, name in other_pages:
            try:
                page.goto(f"{base_url}{path}", wait_until="networkidle", timeout=30000)
                page.wait_for_timeout(500)
                print(f"  ✓ {name}: loaded")
                results["pages"][path] = {"status": "PASS"}
            except Exception as e:
                print(f"  ✗ {name}: {str(e)[:50]}")
                results["pages"][path] = {"status": "FAIL", "error": str(e)}
        
        print()
        
        # Test 10: Navigation Flow
        print("TEST 10: Navigation Flow")
        print("-" * 40)
        try:
            # Go back to landing
            page.goto(base_url, wait_until="networkidle")
            
            # Click through main nav links
            nav = page.locator("nav, header")
            links = page.locator("a[href^='/']").all()[:5]  # First 5 links
            
            for link in links:
                href = link.get_attribute("href")
                if href and href != "/" and not href.startswith("#"):
                    link.click()
                    page.wait_for_timeout(500)
                    print(f"  ✓ Navigated to: {href}")
                    page.go_back()
            
            results["pages"]["navigation"] = {"status": "PASS"}
            
        except Exception as e:
            results["pages"]["navigation"] = {"status": "FAIL", "error": str(e)}
            print(f"  ✗ Error: {e}")
        
        print()
        
        # Test 11: Responsive Design Check
        print("TEST 11: Responsive Design")
        print("-" * 40)
        try:
            # Mobile viewport
            context.close()
            context = browser.new_context(viewport={"width": 375, "height": 667})
            page = context.new_page()
            
            page.goto(base_url, wait_until="networkidle")
            
            # Check if hamburger menu appears
            mobile_menu = page.locator("button[aria-label*='menu' i], button:has-text('Menu')").first
            if mobile_menu.is_visible():
                print("  ✓ Mobile menu visible on small screen")
            
            # Check hero text doesn't overflow
            hero_text = page.locator("h1").first
            box = hero_text.bounding_box()
            if box and box["width"] < 375:
                print("  ⚠ Hero text may be truncated on mobile")
            else:
                print("  ✓ Hero text fits on mobile")
            
            results["pages"]["responsive"] = {"status": "PASS"}
            
        except Exception as e:
            results["pages"]["responsive"] = {"status": "FAIL", "error": str(e)}
            print(f"  ✗ Error: {e}")
        
        print()
        
        # Print console errors
        print("CONSOLE ERRORS CAPTURED:")
        print("-" * 40)
        if console_errors:
            for err in console_errors[:5]:  # First 5 errors
                print(f"  {err[:100]}")
            results["warnings"] = console_errors[:5]
        else:
            print("  ✓ No console errors detected")
        
        browser.close()
        
        # Final Summary
        print("\n" + "="*60)
        print("TEST SUMMARY")
        print("="*60)
        
        passed = sum(1 for p in results["pages"].values() if p.get("status") == "PASS")
        failed = sum(1 for p in results["pages"].values() if p.get("status") == "FAIL")
        total = len(results["pages"])
        
        print(f"\nTotal Pages Tested: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        print(f"Success Rate: {(passed/total*100):.1f}%")
        
        if failed > 0:
            print("\nFailed Pages:")
            for name, result in results["pages"].items():
                if result.get("status") == "FAIL":
                    print(f"  - {name}: {result.get('error', 'Unknown error')}")
        
        print("\n" + "="*60)
        
        return results

if __name__ == "__main__":
    test_oma_frontend()