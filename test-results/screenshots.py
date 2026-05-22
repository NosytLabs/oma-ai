from playwright.sync_api import sync_playwright
import os
import json

output_dir = r"C:\Users\Tyson\Desktop\Development Tools\Active\ai agent\oma\test-results"
os.makedirs(output_dir, exist_ok=True)

pages_config = [
    {"name": "homepage", "url": "http://localhost:3000/"},
    {"name": "dashboard", "url": "http://localhost:3000/dashboard"},
    {"name": "models", "url": "http://localhost:3000/models"},
    {"name": "pricing", "url": "http://localhost:3000/pricing"},
]

results = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    
    desktop_context = browser.new_context(viewport={"width": 1920, "height": 1080})
    mobile_context = browser.new_context(viewport={"width": 375, "height": 812})
    
    for page_info in pages_config:
        name = page_info["name"]
        url = page_info["url"]
        page_result = {"name": name, "url": url, "desktop": {}, "mobile": {}, "errors": []}
        
        print(f"\n{'='*60}\nTesting: {name}\n{'='*60}")
        
        # Desktop
        desktop_page = desktop_context.new_page()
        try:
            response = desktop_page.goto(url, timeout=45000, wait_until="load")
            page_result["desktop"]["status"] = response.status if response else "no_response"
            desktop_page.wait_for_timeout(3000)
            
            desktop_path = os.path.join(output_dir, f"{name}_desktop.png")
            desktop_page.screenshot(path=desktop_path, full_page=True)
            print(f"[OK] Desktop screenshot: {desktop_path}")
            
            page_result["desktop"]["screenshot"] = desktop_path
            page_result["desktop"]["title"] = desktop_page.title()
            page_result["desktop"]["h1_count"] = desktop_page.locator("h1").count()
            page_result["desktop"]["h2_count"] = desktop_page.locator("h2").count()
            page_result["desktop"]["button_count"] = desktop_page.locator("button").count()
            page_result["desktop"]["link_count"] = desktop_page.locator("a").count()
            
        except Exception as e:
            page_result["errors"].append(f"Desktop: {str(e)}")
            print(f"[FAIL] Desktop: {e}")
        finally:
            desktop_page.close()
        
        # Mobile
        mobile_page = mobile_context.new_page()
        try:
            response = mobile_page.goto(url, timeout=45000, wait_until="load")
            mobile_page.wait_for_timeout(3000)
            
            mobile_path = os.path.join(output_dir, f"{name}_mobile.png")
            mobile_page.screenshot(path=mobile_path, full_page=True)
            print(f"[OK] Mobile screenshot: {mobile_path}")
            
            page_result["mobile"]["screenshot"] = mobile_path
            scroll_width = mobile_page.evaluate("document.documentElement.scrollWidth")
            client_width = mobile_page.evaluate("document.documentElement.clientWidth")
            page_result["mobile"]["horizontal_overflow"] = scroll_width > client_width
            page_result["mobile"]["scroll_width"] = scroll_width
            page_result["mobile"]["client_width"] = client_width
            
        except Exception as e:
            page_result["errors"].append(f"Mobile: {str(e)}")
            print(f"[FAIL] Mobile: {e}")
        finally:
            mobile_page.close()
        
        results.append(page_result)
    
    desktop_context.close()
    mobile_context.close()
    browser.close()

# Save results
results_path = os.path.join(output_dir, "results.json")
with open(results_path, "w") as f:
    json.dump(results, f, indent=2)

print(f"\n\n{'='*60}")
print(f"Results saved to: {results_path}")
print('='*60)