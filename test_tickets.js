const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    
    // Login
    console.log('🔐 Logging in...');
    await page.goto('https://opware.kineraw.com/login');
    await page.type('input[type="email"], input[name="username"]', 'admin');
    await page.type('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForNavigation();
    console.log('✓ Logged in successfully');
    
    // Test K2601-0002 (Inquiry ticket - no account)
    console.log('\n📋 Testing K2601-0002 (Inquiry without account)...');
    await page.goto('https://opware.kineraw.com/service/workspace/ticket/K2601-0002');
    await page.waitForTimeout(3000);
    
    // Check if product card exists
    const productCardExists = await page.evaluate(() => {
        return document.querySelector('[data-testid="product-card"]') !== null ||
               document.querySelector('.customer-context-sidebar')?.textContent?.includes('ME6K_002') !== undefined;
    });
    console.log(productCardExists ? '✓ Product card displayed' : '❌ Product card NOT displayed');
    
    // Take screenshot
    await page.screenshot({ path: '/tmp/k2601-0002.png', fullPage: true });
    console.log('📸 Screenshot saved: /tmp/k2601-0002.png');
    
    // Test RMA-D-2601-0001 (RMA ticket with account)
    console.log('\n📦 Testing RMA-D-2601-0001 (RMA with account)...');
    await page.goto('https://opware.kineraw.com/service/workspace/ticket/RMA-D-2601-0001');
    await page.waitForTimeout(3000);
    
    // Check if customer and product cards exist
    const contextInfo = await page.evaluate(() => {
        const sidebar = document.querySelector('.customer-context-sidebar');
        if (!sidebar) return { customer: false, product: false };
        
        const text = sidebar.textContent;
        return {
            customer: text.includes('Cinetx Customer') || text.includes('account'),
            product: text.includes('ME8K_001') || text.includes('MAVO Edge 8K')
        };
    });
    
    console.log(contextInfo.customer ? '✓ Customer card displayed' : '❌ Customer card NOT displayed');
    console.log(contextInfo.product ? '✓ Product card displayed' : '❌ Product card NOT displayed');
    
    // Take screenshot
    await page.screenshot({ path: '/tmp/rma-d-2601-0001.png', fullPage: true });
    console.log('📸 Screenshot saved: /tmp/rma-d-2601-0001.png');
    
    console.log('\n✅ Test complete!');
    await browser.close();
})();
