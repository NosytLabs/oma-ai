from playwright.sync_api import sync_playwright
import os

output_dir = r"C:\Users\Tyson\Desktop\Development Tools\Active\ai agent\oma\test-results"
os.makedirs(output_dir, exist_ok=True)

pages_to_test = [
    {"name": "homepage", "url": "http://localhost:3000/"},
    {"name": "dashboard", "url": "http://localhost:3000/dashboard"},
    {"name": "models", "url": "http://localhost:3000/models"},
    {"name": "pricing", "url": "http://localhost:3000/pricing"},
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    
    # Desktop viewport
    desktop_context = browser.new_context(viewport={"width": 1920, "height": 1080})
    # Mobile viewport
    mobile_context = browser.new_context(viewport={"width": 375, "height": 812})
    
    for page_info in pages_to_test:
        name = page_info["name"]
        url = page_info["url"]
        
        print(f"\n{'='*60}")
        print(f"Testing: {name} ({url})")
        print('='*60)
        
        # Desktop screenshot
        desktop_page = desktop_context.new_page()
        try:
            desktop_page.goto(url, timeout=30000, wait_until="networkidle")
            desktop_page.wait_for_timeout(2000)  # Extra wait for any JS
            desktop_path = os.path.join(output_dir, f"{name}_desktop.png")
            desktop_page.screenshot(path=desktop_path, full_page=True)
            print(f"[OK] Desktop screenshot saved: {desktop_path}")
            
            # Check for console errors on desktop
            desktop_errors = []
            desktop_page.on("console", lambda msg: desktop_errors.append(msg.text) if msg.type == "error" else None)
            desktop_page.evaluate("() => { window.dispatchEvent(new Event('resize')); }")
            desktop_page.wait_for_timeout(1000)
            
            # Get page title and basic structure
            title = desktop_page.title()
            h1_count = desktop_page.locator("h1").count()
            button_count = desktop_page.locator("button").count()
            link_count = desktop_page.locator("a").count()
            img_count = desktop_page.locator("img").count()
            
            print(f"  Title: {title}")
            print(f"  H1 tags: {h1_count}, Buttons: {button_count}, Links: {link_count}, Images: {img_count}")
            print(f"  Console errors: {len(desktop_errors)}")
            
        except Exception as e:
            print(f"[FAIL] Desktop error: {e}")
        finally:
            desktop_page.close()
        
        # Mobile screenshot
        mobile_page = mobile_context.new_page()
        try:
            mobile_page.goto(url, timeout=30000, wait_until="networkidle")
            mobile_page.wait_for_timeout(2000)
            mobile_path = os.path.join(output_dir, f"{name}_mobile.png")
            mobile_page.screenshot(path=mobile_path, full_page=True)
            print(f"[OK] Mobile screenshot saved: {mobile_path}")
            
            # Check for horizontal overflow (responsive issue)
            scroll_width = mobile_page.evaluate("(document.documentElement.scrollWidth)")
            client_width = mobile_page.evaluate("(document.documentElement.clientWidth)")
            has_overflow = scroll_width > client_width
            print(f"  Mobile overflow: {has_overflow} (scroll={scroll_width}, client={client_width})")
            
        except Exception as e:
            print(f"[FAIL] Mobile error: {e}")
        finally:
            mobile_page.close()
    
    desktop_context.close()
    mobile_context.close()
    browser.close()

print(f"\n\nScreenshots saved to: {output_dir}")