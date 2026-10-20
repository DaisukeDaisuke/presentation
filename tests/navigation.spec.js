import { test, expect } from '@playwright/test';
const current = page => page.locator('deck-slide[active]');
test('catalog opens an independent talk and returns to the list', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: '発表資料', exact: true })).toBeVisible();
  await expect(page.locator('presentation-deck')).toHaveCount(0);
  await page.getByRole('link', { name: /バトルエミュレーター/ }).click();
  await at(page, 'intro');
  await page.getByRole('link', { name: '発表一覧', exact: true }).click();
  await expect(page.getByRole('heading', { name: '発表資料', exact: true })).toBeVisible();
  await page.goto('example/');
  await at(page, 'title');
  await page.keyboard.press('ArrowRight'); await at(page, 'topic');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown'); await at(page, 'detail');
  await page.keyboard.press('ArrowUp'); await at(page, 'topic');
  await expect(page).toHaveURL(/#topic\/1$/);
});
test('camera supplement restores progress and stays within the slide', async ({ page }) => {
  await page.goto('16c10/#camera/4');
  await page.keyboard.press('ArrowRight'); await at(page, 'row4');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown'); await at(page, 'stack-residue');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowUp');
  await expect(page).toHaveURL(/#row4\/2$/);
  await page.keyboard.press('ArrowDown');
  await expect(page).toHaveURL(/#stack-residue\/1$/);
});
async function at(page, id) {
  await expect(current(page)).toHaveAttribute('id', id);
  await expect(page.locator('.slide-body:visible')).toHaveCount(1);
}
test('four directions, siblings, deep nesting, explicit jumps, boundaries', async ({ page }) => {
  await page.goto('demo.html');
  await at(page, 'a');
  for (const [key, id] of [
    ['ArrowDown','a1'], ['ArrowDown','deep'], ['ArrowRight','deep'],
    ['ArrowUp','a1'], ['ArrowRight','a2'], ['ArrowLeft','a1'],
    ['ArrowRight','a2'], ['ArrowRight','b'], ['ArrowDown','a2'],
    ['ArrowUp','a'], ['ArrowRight','b'], ['ArrowRight','b'], ['ArrowLeft','a']
  ]) { await page.keyboard.press(key); await at(page, id); }
  await page.getByRole('button', { name: '3階層目へ直接ジャンプ →' }).click();
  await at(page, 'deep');
});
test('fragment, reload, browser history, invalid fragment', async ({ page }) => {
  await page.goto('16c10/#random');
  await at(page, 'random');
  await page.keyboard.press('ArrowDown');
  await at(page, 'timer');
  await page.reload();
  await at(page, 'timer');
  await page.goBack();
  await at(page, 'random');
  await page.goForward();
  await at(page, 'timer');
  await page.goto('16c10/#%E0%A4%A');
  await at(page, 'intro');
});
test('overview, touch buttons, keyboard exclusions, Home and End', async ({ page }) => {
  await page.goto('16c10/');
  await page.keyboard.press('m');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('link', { name: 'ゲーム内タイマー', exact: true }).click();
  await at(page, 'timer');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: '下：子ページ', exact: true }).click();
  await at(page, 'timer-note');
  await page.getByRole('button', { name: '上：親ページ', exact: true }).click();
  await at(page, 'timer');
  await page.keyboard.press('End'); await at(page, 'future');
  await page.keyboard.press('Home'); await at(page, 'intro');
  await page.keyboard.press('m');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.goto('demo.html');
  await page.getByLabel('入力欄では矢印キーを横取りしません').fill('test');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await at(page, 'a');
  await page.locator('#a-title').click();
  await page.keyboard.press('Shift+ArrowRight');
  await at(page, 'a');
  await page.goto('16c10/#case');
  await page.keyboard.press('ArrowRight');
  await page.getByRole('region', { name: /イシュダル戦の抜粋/ }).click();
  await page.keyboard.press('ArrowRight');
  await at(page, 'case');
  await expect(page).toHaveURL(/#case\/2$/);
  expect(await page.locator('#case .case-summary').evaluate(summary =>
    summary.getBoundingClientRect().bottom <= document.querySelector('#case .slide-bottom').getBoundingClientRect().top
  )).toBe(true);
});
test('all slides render without horizontal overflow or JS errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('16c10/');
  const ids = await page.locator('deck-slide').evaluateAll(nodes => nodes.map(n => n.id));
  for (const id of ids) {
    await page.goto('16c10/#' + id + '/999');
    await at(page, id);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), id).toBe(true);
    expect(await page.locator('deck-slide[active] > .slide-body').evaluate(panel => {
      const outer = panel.getBoundingClientRect();
      const footer = panel.querySelector('.slide-bottom')?.getBoundingClientRect();
      return [...panel.querySelectorAll('h1,h2,h3,p,li,img,table,figcaption')].every(element => {
        const box = element.getBoundingClientRect();
        return box.bottom <= outer.bottom + 1 && box.right <= outer.right + 1 && box.left >= outer.left - 1
          && (!footer || element.closest('.slide-bottom') || box.bottom <= footer.top + 1);
      });
    }), id).toBe(true);
  }
  await expect(page.getByRole('link', { name: /実装方法/ })).toHaveCount(0);
  await page.goto('implementation.html');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('構造をHTMLに。');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});
test('source remains readable without JavaScript; all slides print', async ({ browser, baseURL, page }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const plain = await context.newPage();
  await plain.goto(new URL('16c10/', baseURL).href);
  await expect(plain.getByRole('heading', { name: 'バトルエミュレーター', exact: true })).toBeVisible();
  await expect(plain.locator('#future-title')).toBeVisible();
  await context.close();
  await page.goto('16c10/');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.slide-body:visible')).toHaveCount(19);
});
test('right reveals one step, then advances; left reverses; URL retains step', async ({ page }) => {
  await page.goto('16c10/#origin');
  await expect(page.locator('#origin > .slide-body > deck-fragment:not([data-pending])')).toHaveCount(0);
  for (let step = 1; step <= 4; step++) {
    await page.keyboard.press('ArrowRight');
    await at(page, 'origin');
    await expect(page.locator('#origin > .slide-body > deck-fragment:not([data-pending])')).toHaveCount(step);
  }
  await page.keyboard.press('ArrowRight'); await at(page, 'random');
  await page.keyboard.press('ArrowLeft'); await at(page, 'origin');
  await expect(page.locator('#origin > .slide-body > deck-fragment:not([data-pending])')).toHaveCount(4);
  await page.keyboard.press('ArrowLeft');
  await page.reload();
  await expect(page.locator('#origin > .slide-body > deck-fragment:not([data-pending])')).toHaveCount(3);
  await page.goto('16c10/#timer');
  await expect(page.locator('#timer > .slide-body img')).not.toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#timer > .slide-body img')).not.toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#timer > .slide-body img')).toBeVisible();
  expect(await page.locator('#timer > .slide-body img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
});
test('vertical travel restores each slide step; only forward actions fade', async ({ page }) => {
  await page.goto('16c10/#random/2');
  for (const [key, hash] of [
    ['ArrowDown', '#timer'], ['ArrowRight', '#timer/1'], ['ArrowRight', '#timer/2'],
    ['ArrowDown', '#timer-note'], ['ArrowRight', '#timer-note/1'],
    ['ArrowUp', '#timer/2'], ['ArrowUp', '#random/2'], ['ArrowDown', '#timer/2'],
    ['ArrowDown', '#timer-note/1']
  ]) {
    await page.keyboard.press(key);
    expect(await page.evaluate(() => location.hash)).toBe(hash);
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.keyboard.press('ArrowRight');
  expect(await page.locator('presentation-deck').evaluate(deck => deck.runningAnimations.length)).toBe(1);
  await page.keyboard.press('ArrowLeft');
  expect(await page.locator('presentation-deck').evaluate(deck => deck.runningAnimations.length)).toBe(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.keyboard.press('ArrowRight');
  expect(await page.locator('presentation-deck').evaluate(deck => deck.runningAnimations.length)).toBe(0);
});
