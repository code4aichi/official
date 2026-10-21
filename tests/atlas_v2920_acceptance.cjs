/* Run: NODE_PATH=<playwright modules> MIERU_CHROMIUM=<binary> node tests/atlas_v2920_acceptance.cjs */
const {chromium} = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'artifacts/v2920');
fs.mkdirSync(out, {recursive:true});
const results = [];
function check(name, condition, detail='') {
  results.push({name, status:condition?'PASS':'FAIL', detail});
}
const server = http.createServer((req,res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(root + path.sep)) {res.writeHead(403);res.end();return;}
  const resolved = req.url.split('?')[0].endsWith('/')?path.join(file,'index.html'):file;
  fs.readFile(resolved,(error,data)=>{
    if(error){res.writeHead(404);res.end();return;}
    const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.geojson':'application/json','.webp':'image/webp'};
    res.setHeader('Content-Type',mime[path.extname(resolved)]||'application/octet-stream');res.end(data);
  });
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,
    ...(process.env.MIERU_CHROMIUM?{executablePath:process.env.MIERU_CHROMIUM}:{}),
    args:['--no-sandbox','--disable-dev-shm-usage']});
  try {
    for(const width of [1440,1060,1024,820,390,320]) {
      const page=await browser.newPage({viewport:{width,height:950}});
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      const prefix=`${width}px`;
      try {
        await page.goto(`http://127.0.0.1:${server.address().port}/atlas/`,{waitUntil:'networkidle'});
        if(process.env.MIERU_TEST_FONT_CSS) {
          const file=process.env.MIERU_TEST_FONT_CSS;
          const css=fs.readFileSync(file,'utf8').replace(/url\(([^)]+)\)/g,(_,raw)=>{
            const font=path.resolve(path.dirname(file),raw.replace(/["']/g,''));
            return `url(data:font/woff2;base64,${fs.readFileSync(font).toString('base64')})`;
          });
          await page.addStyleTag({content:css+'\nbody{font-family:"Noto Sans JP",sans-serif!important}'});
          await page.evaluate(()=>document.fonts.ready);
        }
        await page.locator('#v2918-shell.v2920-ready').waitFor();
        await page.locator('#map-view path[data-code]').first().waitFor();
        const shell=page.locator('#v2918-shell');
        const tab=view=>({click:async()=>{const button=shell.locator(`button[data-v2918-view="${view}"]`);if(!(await button.isVisible()))await shell.locator('.v2920-secondary-nav>summary').click();await button.click();}});
        check(prefix+' no reference-map DOM',await page.locator('.v2919-reference').count()===0);
        check(prefix+' 54 live map regions',await page.locator('#map-view path[data-code]').count()===54);
        const sizes=await shell.locator('.v2918-controls select').evaluateAll(nodes=>nodes.map(n=>{
          const b=n.getBoundingClientRect();return {width:b.width,x:b.x,y:b.y,height:b.height};
        }));
        check(prefix+' equal full-width controls',sizes.length===4&&Math.max(...sizes.map(b=>b.width))-Math.min(...sizes.map(b=>b.width))<1,JSON.stringify(sizes));
        check(prefix+' aligned control rows',sizes.length===4&&(width>=1060?sizes.every(b=>Math.abs(b.y-sizes[0].y)<1):Math.abs(sizes[0].y-sizes[1].y)<1&&Math.abs(sizes[2].y-sizes[3].y)<1&&sizes[2].y>sizes[0].y));
        const pick=page.locator('#city-select');
        const codes=await pick.locator('option').evaluateAll(ns=>ns.map(n=>n.value).filter(Boolean));
        await pick.selectOption(codes[1]);
        check(prefix+' dropdown highlights map',await page.locator('#map-view path.active').getAttribute('data-code')===codes[1]);
        await page.locator(`#map-view path[data-code="${codes[2]}"]`).dispatchEvent('click');
        check(prefix+' map updates city selector',await pick.inputValue()===codes[2]);
        check(prefix+' map has compact summary',!(await page.locator('.detail>.metric-grid').isVisible())&&await page.locator('.detail>.active-metric-card').isVisible());
        await page.locator('.v2920-open-basic').click();
        check(prefix+' basic CTA opens profile',await shell.getAttribute('data-v2918-view')==='basic');
        check(prefix+' basic excludes map',!(await page.locator('.map-column').isVisible())&&await page.locator('.detail>.metric-grid').isVisible());
        await page.locator('#detail-section-select').selectOption('households');
        check(prefix+' basic sector control works',await page.locator('#city-pane-households').isVisible()&&!(await page.locator('#city-pane-overview').isVisible()));
        await page.locator('#detail-section-select').selectOption('overview');
        for(const view of ['map','basic','compare','ranking','external','discovery','challenge','report','ai-nav','trend','story']) {
          await tab(view).click();
          await page.waitForTimeout(80);
          check(prefix+' '+view+' selected',await shell.getAttribute('data-v2918-view')===view);
          if(!['map','basic'].includes(view)) {
            check(prefix+' '+view+' single panel',await page.locator('#panel-'+view).isVisible()&&!(await page.locator('.detail').isVisible())&&!(await page.locator('.map-column').isVisible()));
          }
          check(prefix+' '+view+' no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
          if([1440,390].includes(width))await shell.screenshot({path:path.join(out,`${width}_${view}.png`)});
        }
        await tab('compare').click();
        await page.locator('#compare-a').selectOption(codes[1]);
        await page.locator('#compare-b').selectOption(codes[2]);
        check(prefix+' comparison renders values',(await page.locator('#comparison').innerText()).trim().length>10);
        await tab('ranking').click();
        await page.locator('#ranking-order').selectOption('asc');
        check(prefix+' ranking renders results',(await page.locator('#chart').innerText()).trim().length>10);
        await tab('ai-nav').click();
        await page.locator('#ai-nav-input').fill('岡崎市の単身世帯率は？');
        await page.locator('#ai-nav-submit').click();
        await page.waitForTimeout(200);
        check(prefix+' statistical question returns result',(await page.locator('#ai-nav-result').innerText()).includes('岡崎'));
        check(prefix+' no JS exceptions',errors.length===0,errors.join('; '));
      } catch(error) {check(prefix+' execution',false,error.stack);}
      finally {await page.close();}
    }
  } finally {await browser.close();server.close();}
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));
  const failed=results.filter(r=>r.status==='FAIL');
  console.log(`PASS ${results.length-failed.length} / FAIL ${failed.length}`);
  for(const row of failed)console.log(JSON.stringify(row));
  if(failed.length)process.exitCode=1;
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
