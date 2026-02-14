/**
 * 截取 TraderMind 页面长图，用于小红书等社交平台
 * 运行: node scripts/screenshot.js
 * 需要: npm install puppeteer (或 npx puppeteer)
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const OUTPUT_DIR = path.join(__dirname, '..', 'screenshots');
const BASE_URL = process.env.APP_URL || 'http://localhost:3000';

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 2 }); // 手机竖屏
    await page.goto(BASE_URL, { waitUntil: 'networkidle0' });

    // 等待启动页消失
    await page.waitForTimeout(2500);

    // 1. 首页 - 当前持仓 (长截图)
    await page.screenshot({
      path: path.join(OUTPUT_DIR, '1-home-positions.png'),
      fullPage: true,
    });
    console.log('已保存: 1-home-positions.png');

    // 2. 点击历史交易
    await page.evaluate(() => {
      [...document.querySelectorAll('button')].find(b => b.textContent.includes('历史交易'))?.click();
    });
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(OUTPUT_DIR, '2-history.png'),
      fullPage: true,
    });
    console.log('已保存: 2-history.png');

    // 3. 切回持仓，打开新建计划弹窗
    await page.evaluate(() => {
      [...document.querySelectorAll('button')].find(b => b.textContent.includes('当前持仓'))?.click();
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      [...document.querySelectorAll('button')].find(b => b.textContent.includes('新建计划'))?.click();
    });
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(OUTPUT_DIR, '3-new-plan-modal.png'),
      fullPage: true,
    });
    console.log('已保存: 3-new-plan-modal.png');

    // 4. 关闭弹窗，截设置页
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle0' });
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(OUTPUT_DIR, '4-settings.png'),
      fullPage: true,
    });
    console.log('已保存: 4-settings.png');

    console.log('\n所有截图已保存到:', OUTPUT_DIR);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
