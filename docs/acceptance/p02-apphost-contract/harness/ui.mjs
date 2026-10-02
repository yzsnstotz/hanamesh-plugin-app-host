// Real Google Chrome (Playwright driver, read-only dependency of hanamesh-web-market) against the isolated DSH web host.
// usage: node ui.mjs <tag> <port> <out-prefix> <steps-json>   steps: {"goto":"/path"} {"wait":ms} {"capture":"sfx"} {"click":"text"}
import fs from 'node:fs';
import { chromium } from '/Users/yzliu/work/projects/hanamesh/hanamesh-web-market/node_modules/playwright/index.mjs';
const [tag, port, prefix, stepsJson] = process.argv.slice(2), RUN = process.env.RUN, EVID = process.env.EVID;
const url = fs.readFileSync(`${RUN}/${tag}.url`, 'utf8').trim(), red = s => s.replace(/token=[A-Za-z0-9_-]+/g, 'token=<redacted>');
const browser = await chromium.launch({ headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const out = { tag:prefix, captures:[], consoleErrors:[], hanameshRequests:[] };
try {
  const page = await browser.newPage({ viewport:{ width:1440, height:1000 } });
  page.on('console', m => { if (m.type() === 'error') out.consoleErrors.push(red(m.text()).slice(0, 300)); });
  page.on('response', r => { const u = new URL(r.url()); if (/hanamesh|\/apps\//.test(u.pathname)) out.hanameshRequests.push(`${r.request().method()} ${u.pathname} ${r.status()}`); });
  const nav = await page.goto(url, { waitUntil:'domcontentloaded', timeout:30_000 }); out.rootStatus = nav?.status() ?? null;
  await page.waitForTimeout(2_000);
  for (const t of ['Continue', 'Configure later']) { const b = page.getByText(t, { exact:true }); if (await b.isVisible().catch(() => false)) { await b.click(); await page.waitForTimeout(800); } }
  for (const s of JSON.parse(stepsJson || '[]')) {
    if (s.goto) { const r = await page.goto(new URL(s.goto, `http://127.0.0.1:${port}/`).toString(), { waitUntil:'domcontentloaded' }); out[`goto ${s.goto}`] = r?.status() ?? null; }
    else if (s.wait) await page.waitForTimeout(s.wait);
    else if (s.click) await page.getByText(s.click, { exact:false }).first().click();
    else if (s.capture) { const f = `${prefix}-${s.capture}`; fs.writeFileSync(`${EVID}/ui/${f}.txt`, JSON.stringify({ title:await page.title(), path:new URL(page.url()).pathname, bodyText:red((await page.locator('body').innerText()).slice(0, 20_000)) }, null, 2));
      await page.screenshot({ path:`${EVID}/ui/${f}.png`, fullPage:true }); out.captures.push(f); }
  }
} finally { await browser.close(); }
console.log(JSON.stringify(out));
