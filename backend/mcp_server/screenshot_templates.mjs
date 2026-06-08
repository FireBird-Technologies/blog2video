// /**
//  * One-time script: screenshot each template card from the live gallery page.
//  *
//  * Prerequisites:
//  *   1. npm install puppeteer  (in backend/mcp_server/ui_src/)
//  *   2. Backend must be running: uvicorn app.main:app --port 8000
//  *
//  * Usage:
//  *   node backend/mcp_server/screenshot_templates.mjs
//  *
//  * Output:
//  *   /tmp/b2v-template-previews/<template_id>.png  (12 files)
//  *
//  * Then run upload_template_previews.py to upload to R2.
//  */

// import { createRequire } from 'module';
// import fs from 'fs';
// import path from 'path';

// // Resolve puppeteer from the ui_src node_modules
// const require = createRequire(import.meta.url);
// let puppeteer;
// try {
//   puppeteer = require(path.join(
//     path.dirname(new URL(import.meta.url).pathname),
//     'ui_src/node_modules/puppeteer'
//   ));
// } catch {
//   console.error(
//     'Puppeteer not found. Run:\n  cd backend/mcp_server/ui_src && npm install puppeteer'
//   );
//   process.exit(1);
// }

// const GALLERY_URL = 'http://localhost:8000/mcp/ui/template_gallery';
// const OUT_DIR = '/tmp/b2v-template-previews';

// // Order must match the gallery render order from /api/templates
// const TEMPLATE_IDS = [
//   'default', 'nightfall', 'gridcraft', 'spotlight', 'whiteboard',
//   'newspaper', 'matrix', 'newscast', 'mosaic', 'blackswan', 'bloomberg', 'chronicle',
// ];

// fs.mkdirSync(OUT_DIR, { recursive: true });

// console.log('Launching Chrome…');
// const browser = await puppeteer.launch({
//   executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
//   headless: 'new',
//   args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
// });

// const page = await browser.newPage();

// // Wide enough to fit 3 columns without wrapping
// await page.setViewport({ width: 1440, height: 1200, deviceScaleFactor: 2 });

// console.log(`Opening ${GALLERY_URL}…`);
// await page.goto(GALLERY_URL, { waitUntil: 'networkidle0', timeout: 30000 });

// // Wait for React to mount and the API data to arrive
// await page.waitForSelector('.card', { timeout: 15000 });

// // Extra wait for preview animations and fonts to settle
// await new Promise(r => setTimeout(r, 2000));

// const cards = await page.$$('.card');
// console.log(`Found ${cards.length} cards (expecting 12)`);

// if (cards.length === 0) {
//   console.error('No .card elements found — is the gallery page loading correctly?');
//   await browser.close();
//   process.exit(1);
// }

// for (let i = 0; i < cards.length; i++) {
//   const tid = TEMPLATE_IDS[i] ?? `template_${i}`;
//   const outPath = path.join(OUT_DIR, `${tid}.png`);

//   // Scroll the card into view so the preview animation has started
//   await page.evaluate(el => el.scrollIntoView({ block: 'center' }), cards[i]);
//   await new Promise(r => setTimeout(r, 300));

//   await cards[i].screenshot({ path: outPath, type: 'png' });
//   console.log(`  ✅ ${tid}.png`);
// }

// await browser.close();
// console.log(`\nAll screenshots saved to ${OUT_DIR}`);
// console.log('\nNext step:');
// console.log('  cd backend && python mcp_server/upload_template_previews.py');
