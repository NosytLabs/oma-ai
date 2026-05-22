from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox', '--disable-setuid-sandbox'])
    page = browser.new_page(viewport={'width': 1280, 'height': 720})
    
    # Test landing page
    page.goto('http://localhost:3000', timeout=60000)
    page.wait_for_load_state('networkidle')
    page.screenshot(path='C:/Users/Tyson/Desktop/Development Tools/Active/ai agent/oma/test-screenshots/landing.png', full_page=True)
    
    # Test pricing page
    page.goto('http://localhost:3000/pricing', timeout=60000)
    page.wait_for_load_state('networkidle')
    page.screenshot(path='C:/Users/Tyson/Desktop/Development Tools/Active/ai agent/oma/test-screenshots/pricing.png', full_page=True)
    
    # Test models page
    page.goto('http://localhost:3000/models', timeout=60000)
    page.wait_for_load_state('networkidle')
    page.screenshot(path='C:/Users/Tyson/Desktop/Development Tools/Active/ai agent/oma/test-screenshots/models.png', full_page=True)
    
    # Test API health endpoint (JSON response)
    response = page.goto('http://localhost:3001/health', timeout=60000)
    health_text = page.content()
    print(f"API Health response: {health_text}")
    
    browser.close()
    print("Screenshots saved to test-screenshots/")