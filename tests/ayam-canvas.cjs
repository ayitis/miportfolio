// Run against a static server with Playwright installed. Set SCREENSHOTS to an existing output directory.
const { chromium }=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.BASE_URL ?? 'http://127.0.0.1:4200';
(async()=>{
 const browser=await chromium.launch(process.env.CHROMIUM ? {executablePath:process.env.CHROMIUM} : {});
 try{
 const context=await browser.newContext({viewport:{width:1190,height:730}});
 const design = {
  version: 1, page: 'ayam', desktop: {}, mobile: {}, content: {}, elements: {},
  ayam: { assets: {}, desktop: { media: { 'photo-04': { x: 4 }, 'photo-01': { cropX: 52 } } }, mobile: {} },
 };
 const text = {
  ego: ["IT'S NOT EGO", 75, 1686, 350, 40],
  existence: ["IT'S EXISTENCE", 545, 1743, 440, 47],
  paragraph1: ['It is not about ego, but about existence.', 512, 1373, 148, 13],
  paragraph2: ['About recognising who we are, embracing our individuality and allowing ourselves to evolve.', 512, 1472, 148, 13],
 };
 for (const [name, [value, x, y, width, size]] of Object.entries(text)) {
  const id = 'custom.' + name;
  design.elements[id] = { type: 'text' };
  design.content[id] = { text: value };
  design.desktop[id] = { x, y, width, size };
 }
 await context.route('**/api/portfolio-config',r=>r.fulfill({json:{url:base,key:'fixture'}}));
 await context.route('**/auth/v1/**', r=>r.fulfill({json:{access_token:'fixture',refresh_token:'fixture',expires_in:3600}}));
 await context.route('**/rest/v1/**', r=>{
  const url = new URL(r.request().url());
  if (url.pathname.endsWith('/portfolio_is_owner')) return r.fulfill({json:true});
  if (url.searchParams.get('page') === 'eq.ayam') return r.fulfill({json:[{document:design,revision:1}]});
  return r.fulfill({json:[]});
 });
 const page=await context.newPage();
 const open=async width=>{
  await page.setViewportSize({width,height:730});
  await page.goto(base+'/ayam.html');
  await page.locator('[data-custom-text="custom.existence"]').waitFor();
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('.ayam-news img')].map(i=>{i.loading='eager';return i.decode()}));});
 };
 const editor=await context.newPage();
 await editor.setViewportSize({width:1530,height:960});
 await editor.goto(base+'/editor/');
 await editor.getByText('Inicia sesión con la cuenta autorizada.').waitFor();
 await editor.getByLabel('Correo', {exact:true}).fill('owner@example.invalid');
 await editor.getByLabel('Contraseña', {exact:true}).fill('fixture-password');
 await editor.getByRole('button',{name:'Entrar'}).click();
 await editor.locator('#page').selectOption('ayam');
 await editor.getByText('Editando AYAM.').waitFor();
 await editor.locator('#viewport-tools summary').click();
 await editor.locator('#viewport-width').fill('1190');
 await editor.locator('#viewport-width').blur();
 await editor.locator('#viewport-height').fill('730');
 await editor.locator('#viewport-height').blur();
 const editorFrame=await (await editor.locator('#preview').elementHandle()).contentFrame();
 await editorFrame.locator('[data-custom-text="custom.existence"]').waitFor();
 await editorFrame.evaluate(()=>document.fonts.ready);
 const measure=()=>{
   const selectors=['.site-header','.hero-film','#ayam-title','#campaign-title','.section-head p',...Array.from(document.querySelectorAll('.ayam-news figure'),n=>'[data-ayam-media="'+n.dataset.ayamMedia+'"] img'),'.editorial-note h3','.section-break h3','.section-break-copy strong','.chapter-list','footer','[data-custom-text="custom.ego"]','[data-custom-text="custom.existence"]','[data-custom-text="custom.paragraph1"]','[data-custom-text="custom.paragraph2"]'];
   const boxes=Object.fromEntries(selectors.map(s=>{const r=document.querySelector(s).getBoundingClientRect();return [s,[r.x,r.y,r.width,r.height]];}));
   const photos=[...document.querySelectorAll('.ayam-news img')].map(n=>n.getBoundingClientRect());
   const overlaps=[...document.querySelectorAll('[data-custom-text]')].map(n=>{
    const r=n.getBoundingClientRect();
    return [n.dataset.customText,photos.some(p=>Math.min(p.right,r.right)-Math.max(p.left,r.left)>1&&Math.min(p.bottom,r.bottom)-Math.max(p.top,r.top)>1)];
   });
   return {boxes,overlaps,width:document.documentElement.clientWidth,height:document.documentElement.scrollHeight};
 };
 const reference = Object.values((await editorFrame.evaluate(measure)).boxes).flat();
 for (const width of [1190,1280,1440,1525]) {
  await open(width);
  const results=await page.evaluate(measure);
  const normalized=Object.values(results.boxes).flat().map(v=>v*1190/results.width);
  const max=Math.max(...normalized.map((v,i)=>Math.abs(v-reference[i])));
  console.log(width,'drift',max.toFixed(2),'overlaps',JSON.stringify(results.overlaps),'height',results.height);
  if (process.env.SCREENSHOTS) await page.screenshot({path:`${process.env.SCREENSHOTS}/ayam-${width}.png`,fullPage:true});
  assert.ok(max<=2, 'Normalized geometry drift: '+max);
  assert.ok(results.overlaps.every(([,overlap])=>!overlap),JSON.stringify(results.overlaps));
 }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
