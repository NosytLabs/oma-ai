from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    
    # Test desktop viewport
    context = browser.new_context(viewport={"width": 1280, "height": 900})
    page = context.new_page()
    
    # Landing page
    print("Testing landing page...")
    page.goto("http://localhost:3000", timeout=30000)
    page.wait_for_load_state("networkidle")
    page.screenshot(path="test-screenshots/landing-desktop.png", full_page=True)
    print("  Landing page rendered OK")
    
    # Pricing page
    print("Testing pricing page...")
    page.goto("http://localhost:3000/pricing", timeout=30000)
    page.wait_for_load_state("networkidle")
    page.screenshot(path="test-screenshots/pricing-desktop.png", full_page=True)
    print("  Pricing page rendered OK")
    
    # Models page
    print("Testing models page...")
    page.goto("http://localhost:3000/models", timeout=30000)
    page.wait_for_load_state("networkidle")
    page.screenshot(path="test-screenshots/models-desktop.png", full_page=True)
    print("  Models page rendered OK")
    
    # Mobile viewport test
    print("Testing mobile viewport...")
    mobile_context = browser.new_context(viewport={"width": 375, "height": 812})
    mobile_page = mobile_context.new_page()
    
    mobile_page.goto("http://localhost:3000", timeout=30000)
    mobile_page.wait_for_load_state("networkidle")
    mobile_page.screenshot(path="test-screenshots/landing-mobile.png", full_page=True)
    print("  Mobile landing page rendered OK")
    
    mobile_page.goto("http://localhost:3000/pricing", timeout=30000)
    mobile_page.wait_for_load_state("networkidle")
    mobile_page.screenshot(path="test-screenshots/pricing-mobile.png", full_page=True)
    print("  Mobile pricing page rendered OK")
    
    # Privacy page
    print("Testing privacy page...")
    page.goto("http://localhost:3000/privacy", timeout=30000)
    page.wait_for_load_state("networkidle")
    page.screenshot(path="test-screenshots/privacy-desktop.png", full_page=True)
    print("  Privacy page rendered OK")
    
    browser.close()
    print("\nAll screenshots captured successfully!")
