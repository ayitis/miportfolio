// Start a static server at the repo root, then run this with Playwright installed.
// BASE_URL=http://localhost:4200 node tests/editor-parity.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const base = process.env.BASE_URL ?? 'http://localhost:4200';
const cases = {
  ayam: ['/ayam.html', ['intro.title', 'campaign.title', 'project.title']],
  nuptias: ['/nuptias.html', ['editorial.roles', 'concept.title', 'concept.description']],
  'maison-carnage': ['/maison-carnage.html', ['masthead.maison', 'intro.kicker', 'campaign.title']],
  home: ['/index.html', ['about.title', 'about.description', 'about.closing']],
};
const measure = node => {
  const { x, y, width, height } = node.getBoundingClientRect();
  return [x + scrollX, y + scrollY, width, height];
};

async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    if (document.documentElement.dataset.designPage === 'ayam') {
      const images = [...document.querySelectorAll('.ayam-news img')];
      images.forEach(image => { image.loading = 'eager'; });
      await Promise.all(images.map(image => image.decode()));
    }
    await Promise.all([...document.images].filter(img => img.complete && img.naturalWidth).map(img => img.decode().catch(() => {})));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function main() {
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  try {
    const context = await browser.newContext({ viewport: { width: 1060, height: 950 }, reducedMotion: 'reduce' });
    const drafts = new Map(), published = new Map();
    let revision = 0;
    // Isolated REST fixtures. No real Supabase endpoint is contacted.
    await context.route('**/api/portfolio-config', route => route.fulfill({ json: { url: base, key: 'fixture' } }));
    await context.route('**/auth/v1/**', route => route.fulfill({ json: { access_token: 'owner', refresh_token: 'fixture', expires_in: 3600 } }));
    await context.route('**/rest/v1/**', route => {
      const request = route.request();
      const url = new URL(request.url());
      const endpoint = url.pathname.split('/').pop();
      const key = url.searchParams.get('page')?.slice(3);
      if (endpoint === 'portfolio_is_owner') return route.fulfill({ json: true });
      if (endpoint.startsWith('portfolio_save_')) {
        const { design, expected_revision, publish_now } = request.postDataJSON();
        assert.equal(expected_revision, drafts.get(design.page)?.revision ?? null);
        const entry = { document: design, revision: ++revision };
        drafts.set(design.page, entry);
        if (publish_now) published.set(design.page, entry);
        return route.fulfill({ json: revision });
      }
      const saved = (endpoint === 'portfolio_published' ? published : drafts).get(key);
      return route.fulfill({ json: endpoint === 'portfolio_history' || !saved ? [] : [saved] });
    });

    const editor = await context.newPage();
    const visitor = await context.newPage();
    editor.on('dialog', dialog => dialog.accept());
    await editor.goto(base + '/editor/');
    await editor.getByText('Inicia sesión con la cuenta autorizada.').waitFor();
    await editor.getByLabel('Correo', { exact: true }).fill('owner@example.invalid');
    await editor.getByLabel('Contraseña', { exact: true }).fill('fixture-password');
    await editor.getByRole('button', { name: 'Entrar' }).click();
    const results = [];
    for (const [key, [path, ids]] of Object.entries(cases)) {
      if (process.env.ONLY && process.env.ONLY !== key) continue;
      await editor.locator('#page').selectOption(key);
      const frameLocator = editor.frameLocator('#preview');
      const frame = await (await editor.locator('#preview').elementHandle()).contentFrame();
      await editor.getByText(`Editando ${key === 'home' ? 'Home / Portada' : key === 'maison-carnage' ? 'MAISON CARNAGE' : key.toUpperCase()}.`).waitFor();
      const pages = await editor.evaluate(() => import('/portfolio/pages.js').then(module => module.pages));
      const selectors = ids.map(id => pages[key].targets.find(target => target[0] === id)[2]);
      for (const [index, mode] of ['Escritorio', 'Móvil'].entries()) {
        await editor.getByRole('button', { name: mode, exact: true }).click();
        if (key === 'ayam' && process.env.EXACT_WIDTHS) {
          const width = index ? '738' : '1280';
          const tools = editor.locator('#viewport-tools');
          if (await tools.getAttribute('open') === null) await tools.locator('summary').click();
          await tools.locator('#viewport-width').fill(width);
          await tools.locator('#viewport-width').blur();
          await tools.locator('#viewport-height').fill('900');
          await tools.locator('#viewport-height').blur();
          assert.equal(await frame.evaluate(() => innerWidth), Number(width));
        }
        const picker = editor.locator('#element');
        const fields = name => editor.locator(`[data-field="${name}"]`);
        for (const [i, id] of ids.entries()) {
          await picker.selectOption(id);
          await fields('x').fill(String([21, -37, 42][i] + index));
          await fields('y').fill(String([28, -19, 34][i] + index));
        }
        if (key === 'ayam') {
          await fields('size').fill(index ? '41' : '56');
          await fields('align').selectOption('right');
          const snap = editor.locator('#snap-text');
          if (!(await snap.isVisible())) await editor.locator('.alignment-tools summary').click();
          await snap.uncheck();
          const selected = frameLocator.locator(selectors[2]);
          await selected.scrollIntoViewIfNeeded();
          const box = await selected.boundingBox();
          await editor.mouse.move(box.x + 12, box.y + 10);
          await editor.mouse.down();
          await editor.mouse.move(box.x + 29, box.y + 25, { steps: 3 });
          await editor.mouse.up();
          assert.equal(await fields('x').inputValue(), String(59 + index));
          assert.equal(await fields('y').inputValue(), String(49 + index));
        }
        await editor.locator('#save').click();
        await editor.getByText('Borrador guardado de forma privada.').waitFor();
        await editor.locator('#publish').click();
        await editor.getByText('Cambios publicados.').waitFor();
        await settle(frame);
        const metrics = await frame.evaluate(() => ({ width: innerWidth, height: innerHeight, contentWidth: document.documentElement.clientWidth }));
        const expected = await Promise.all(selectors.map(selector => frameLocator.locator(selector).first().evaluate(measure)));
        await visitor.setViewportSize({width: metrics.width, height: metrics.height});
        await visitor.goto(base + path);
        for (const step of ['initial', 'reload', 'scroll']) {
          if (step === 'reload') await visitor.reload();
          await visitor.waitForFunction(selector => Boolean(document.querySelector(selector)?.style.translate), selectors[0], {timeout: 8000})
            .catch(error => { if (!process.env.BASELINE) throw error; });
          if (step === 'scroll') {
            const scroll = async page => page.evaluate(() => scrollTo({top: 300, behavior: 'instant'}));
            await scroll(visitor);
            await scroll(frame);
            const scrolledEditor = await Promise.all(selectors.map(selector => frameLocator.locator(selector).first().evaluate(measure)));
            if (key === 'ayam') assert.deepEqual(scrolledEditor, expected, 'AYAM position changed on scroll in editor');
          }
          await settle(visitor);
          const actual = await Promise.all(selectors.map(selector => visitor.locator(selector).first().evaluate(measure)));
          const delta = expected.map((rect, i) => rect.map((value, j) => +(actual[i][j] - value).toFixed(3)));
          results.push({ key, mode, viewport: metrics, step, delta });
          console.log(JSON.stringify(results.at(-1)));
          if (!process.env.BASELINE) assert.ok(delta.flat().every(value => Math.abs(value) <= 2));
        }
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
