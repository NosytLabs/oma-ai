from playwright.sync_api import sync_playwright
import os

BASE_URL = "http://localhost:3000"
PAGES = ["/", "/playground", "/pricing", "/models", "/stake", "/deposit", "/dashboard", "/docs", "/swap"]
OUTPUT_DIR = "C:/Users/Tyson/Desktop/Development Tools/Active/ai agent/oma/audit-screenshots"

def analyze_page(page, name):
    html = page.content()
    
    issues = []
    
    # Check for terminal aesthetic remnants
    mono_in_body = page.locator('body').evaluate('el => getComputedStyle(el).fontFamily')
    if 'mono' in mono_in_body.lower() or 'Menlo' in mono_in_body or 'Consolas' in mono_in_body:
        issues.append("Terminal aesthetic: Uses monospace font in body")
    
    # Check for uppercase labels
    uppercase_labels = page.locator('text=/^[A-Z][A-Z0-9 ]+$/').count()
    if uppercase_labels > 0:
        issues.append(f"Terminal aesthetic: Found {uppercase_labels} uppercase labels")
    
    # Check for terminal-style elements
    terminal_elements = page.locator('[class*="terminal"], [class*="console"], [class*="cmd"]').count()
    if terminal_elements > 0:
        issues.append(f"Terminal aesthetic: Found {terminal_elements} terminal-style elements")
    
    # Check for cyan accents
    cyan_elements = page.locator('[style*="cyan"], [class*="cyan"]').count()
    
    # Check for indigo/rose accents
    indigo_elements = page.locator('[class*="indigo"], [class*="rose"], [style*="indigo"], [style*="rose"]').count()
    
    # Check for color inconsistencies
    if cyan_elements > 0 and indigo_elements > 0:
        issues.append(f"Color inconsistency: Mixed cyan ({cyan_elements}) and indigo/rose ({indigo_elements}) accents")
    
    # Check for font families
    h1_fonts = page.locator('h1').evaluate_all('els => els.map(el => getComputedStyle(el).fontFamily)')
    p_fonts = page.locator('p').evaluate_all('els => els.map(el => getComputedStyle(el).fontFamily)')
    
    unique_h1_fonts = set([f for f in h1_fonts if f])
    unique_p_fonts = set([f for f in p_fonts if f])
    
    if len(unique_h1_fonts) > 1:
        issues.append(f"Font inconsistency: Multiple H1 fonts detected: {unique_h1_fonts}")
    if len(unique_p_fonts) > 1:
        issues.append(f"Font inconsistency: Multiple paragraph fonts detected: {unique_p_fonts}")
    
    # Check for AI-slop indicators (gradient backgrounds, generic hero sections)
    gradients = page.locator('[style*="gradient"]').count()
    if gradients > 3:
        issues.append(f"AI-slop aesthetic: Excessive gradient usage ({gradients})")
    
    return issues

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1920, 'height': 1080})
    
    results = []
    
    for path in PAGES:
        url = BASE_URL + path
        print(f"\n{'='*60}")
        print(f"Analyzing: {path}")
        print(f"URL: {url}")
        print('='*60)
        
        try:
            page.goto(url, wait_until='networkidle', timeout=30000)
            page.wait_for_timeout(1000)  # Extra wait for animations
            
            # Take screenshot
            safe_name = path.strip('/') if path != '/' else 'homepage'
            screenshot_path = os.path.join(OUTPUT_DIR, f"{safe_name}.png")
            page.screenshot(path=screenshot_path, full_page=True)
            print(f"Screenshot saved: {screenshot_path}")
            
            # Analyze page
            issues = analyze_page(page, path)
            results.append({
                'page': path,
                'screenshot': screenshot_path,
                'issues': issues
            })
            
            if issues:
                print(f"ISSUES FOUND:")
                for issue in issues:
                    print(f"  - {issue}")
            else:
                print("No major issues detected")
                
        except Exception as e:
            print(f"ERROR: {str(e)}")
            results.append({
                'page': path,
                'error': str(e)
            })
    
    browser.close()

# Print summary
print("\n" + "="*80)
print("SUMMARY OF ALL ISSUES")
print("="*80)
for r in results:
    print(f"\n{r['page']}:")
    if 'error' in r:
        print(f"  ERROR: {r['error']}")
    elif r['issues']:
        for issue in r['issues']:
            print(f"  - {issue}")
    else:
        print("  Clean - no issues detected")
