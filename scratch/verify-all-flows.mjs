import { Browser, sleep } from 'file:///D:/hao/hao/02_DU_AN_VA_LAP_TRINH/taste-skill/skills/taste-skill/scripts/lib/cdp.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const outDir = 'C:/Users/hao/.gemini/antigravity/brain/2d4cc9d4-c079-4b3b-aca3-71591fdc0d23/scratch';
mkdirSync(outDir, { recursive: true });

async function verify() {
  const browser = await Browser.launch({ width: 1440, height: 900 });
  const page = await browser.newPage({ width: 1440, height: 900 });

  await page.goto('http://127.0.0.1:3000/?mode=user');
  await sleep(600);

  const portals = [
    { id: 1, name: 'Customer (Khách hàng)' },
    { id: 2, name: 'Provider (Đối tác Thợ)' },
    { id: 3, name: 'Admin (Quản trị)' },
    { id: 0, name: 'Auth (Tài khoản / Đăng ký)' }
  ];

  for (const portal of portals) {
    await page.eval(`window.GDXApp.switchPortal(${portal.id})`);
    await sleep(400);

    const info = await page.eval(`(() => {
      const nav = document.getElementById('userMainNav');
      const tabs = Array.from(nav.querySelectorAll('.portal-tab'));
      const rects = tabs.map(t => {
        const r = t.getBoundingClientRect();
        return { label: t.textContent.trim(), top: Math.round(r.top), left: Math.round(r.left), width: Math.round(r.width), height: Math.round(r.height) };
      });
      const topbar = document.querySelector('.shell-topbar').getBoundingClientRect();
      const distinctTops = [...new Set(rects.map(r => r.top))];
      return {
        portalName: '${portal.name}',
        tabsCount: tabs.length,
        distinctTops,
        isOnOneRow: distinctTops.length <= 1,
        tabs: rects,
        topbarHeight: Math.round(topbar.height)
      };
    })()`);

    console.log(`=== PORTAL ${portal.id}: ${portal.name} ===`);
    console.log(`Tabs count: ${info.tabsCount}`);
    console.log(`Distinct top offsets: ${JSON.stringify(info.distinctTops)} (Is on 1 row: ${info.isOnOneRow})`);
    console.log(`Topbar height: ${info.topbarHeight}px`);
    for (const t of info.tabs) {
      console.log(`  - [${t.label}] top: ${t.top}px, left: ${t.left}px, width: ${t.width}px, height: ${t.height}px`);
    }

    const shot = await page.screenshot();
    writeFileSync(join(outDir, `flow-portal-${portal.id}.jpg`), shot);
  }

  await browser.close();
}

verify().catch(e => {
  console.error(e);
  process.exit(1);
});
