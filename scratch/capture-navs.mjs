import { chromium } from 'file:///D:/hao/hao/02_DU_AN_VA_LAP_TRINH/taste-skill/skills/taste-skill/node_modules/playwright/index.mjs';
import fs from 'fs';
import path from 'path';

const outDir = 'C:/Users/hao/.gemini/antigravity/brain/2d4cc9d4-c079-4b3b-aca3-71591fdc0d23/scratch';
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  // 1. User flow
  await page.goto('http://127.0.0.1:3000/?mode=user', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const headerUser = await page.$('.shell-topbar');
  if (headerUser) {
    await headerUser.screenshot({ path: path.join(outDir, 'nav-user.jpg') });
  }

  // 2. Provider flow
  await page.evaluate(() => {
    window.GDXApp.switchPortal(2);
  });
  await page.waitForTimeout(600);
  const headerProv = await page.$('.shell-topbar');
  if (headerProv) {
    await headerProv.screenshot({ path: path.join(outDir, 'nav-provider.jpg') });
  }

  // 3. Admin flow
  await page.evaluate(() => {
    window.GDXApp.switchPortal(3);
  });
  await page.waitForTimeout(600);
  const headerAdmin = await page.$('.shell-topbar');
  if (headerAdmin) {
    await headerAdmin.screenshot({ path: path.join(outDir, 'nav-admin.jpg') });
  }

  // 4. Auth flow
  await page.evaluate(() => {
    window.GDXApp.switchPortal(0);
  });
  await page.waitForTimeout(600);
  const headerAuth = await page.$('.shell-topbar');
  if (headerAuth) {
    await headerAuth.screenshot({ path: path.join(outDir, 'nav-auth.jpg') });
  }

  console.log('ALL NAV SCREENSHOTS CAPTURED SUCCESSFULLY!');
  await browser.close();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
