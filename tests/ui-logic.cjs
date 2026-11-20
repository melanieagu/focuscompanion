// Dependency-free app-state tests in a DOM stub, not a real browser renderer.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const source = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
function makeApp(saved = new Map(), start = 1800000000000) {
  let clock = start;
  class MockDate extends Date { constructor(...args) { super(...(args.length ? args : [clock])); } static now() { return clock; } }
  const elements = [];
  for (const match of html.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)) {
    const attrs = {}; for (const a of match[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g)) attrs[a[1]] = a[2] ?? '';
    const element = { tag: match[1], attrs, id: attrs.id, hidden: 'hidden' in attrs, disabled: false, value: attrs.value || '', textContent: '', dataset: {}, style: {}, open: false,
      setAttribute(k,v) { this.attrs[k]=v; }, getAttribute(k){return this.attrs[k]},
      addEventListener(name,fn){this['on'+name]=fn}, focus(){}, select(){} };
    for(const [key,value] of Object.entries(attrs)) if(key.startsWith('data-')) element.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=value;
    elements.push(element);
  }
  const ids = Object.fromEntries(elements.filter(e=>e.id).map(e=>[e.id,e]));
  // Default selected option values from source, sufficient for these state tests.
  ids['pact-duration'].value='1500'; ids['pact-stake'].value='0.0001';
  const selectAll = selector => elements.filter(e=> selector==='button' ? e.tag==='button' : selector.startsWith('[') && selector.endsWith(']') ? selector.slice(1,-1) in e.attrs : false);
  const context = {console, URL, URLSearchParams, BigInt, Math, Date:MockDate, setInterval(){}, clearInterval(){},
    location:{href:'http://localhost:3000/',hostname:'localhost',search:'',reload(){}},
    history:{replaceState(_a,_b,url){context.location.href=url.href;context.location.search=url.search;}},
    navigator:{clipboard:{async writeText(){}}},
    document:{getElementById:id=>ids[id],querySelectorAll:selectAll,body:{setAttribute(){},removeAttribute(){}}},
    localStorage:{getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v)},
    FOCUS_CONFIG:{contractAddress:'',chainId:11155111,explorer:'https://sepolia.etherscan.io'},FOCUS_ARTIFACT:null,
    confirm:()=>true};
  context.window=context; vm.createContext(context); vm.runInContext(source,context);
  const run=code=>vm.runInContext(code,context);
  const click=async id=>{await ids[id].onclick();};
  const flush=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};
  return {ids,run,click,flush,saved,advance:s=>{clock+=s*1000;run('tick()')},clock:()=>clock};
}
(async()=>{
  let app=makeApp(); await app.flush();
  app.ids.task.value='Study';app.run('selectedSeconds=10');
  app.ids['focus-form'].onsubmit({preventDefault(){}});
  assert.equal(app.ids.focusing.hidden,false); assert.equal(app.ids['active-task'].textContent,'Study');
  app.advance(4);assert.equal(app.ids.countdown.textContent,'00:06');
  app=makeApp(app.saved,app.clock());await app.flush();assert.equal(app.ids.focusing.hidden,false);
  app.advance(6);assert.equal(app.ids.complete.hidden,false);assert.equal(app.ids['session-count'].textContent,'1 session today');
  app.run('finishSession()');assert.equal(app.ids['session-count'].textContent,'1 session today');
  await app.click('back-home');assert.equal(app.ids.home.hidden,false);
  console.log('PASS solo countdown, reload recovery, completion, idempotent count and home');
  app.run("setMode('preview')");app.ids['pact-task'].value='Essay';app.ids['pact-duration'].value='10';
  app.ids['create-form'].onsubmit({preventDefault(){}});await app.flush();
  assert.equal(app.ids['pact-room'].hidden,false);assert.equal(app.ids['preview-banner'].hidden,false);assert.equal(app.ids['join-pact'].hidden,true);
  await app.click('preview-join');await app.click('view-session');app.advance(10);
  assert.equal(app.ids.complete.hidden,false);
  await app.click('confirm-pact');await app.flush();assert.equal(app.ids['withdraw-pact'].hidden,true);
  await app.click('preview-confirm');assert.equal(app.ids['withdraw-pact'].hidden,false);
  await app.click('withdraw-pact');assert.match(app.ids['room-status'].textContent,/No funds moved/);
  console.log('PASS preview flow labels, joined session, both confirmations and simulated claim');
  app=makeApp(app.saved,app.clock());await app.flush();await app.click('resume-pact');await app.flush();
  assert.match(app.ids['room-status'].textContent,/No funds moved/);
  console.log('PASS preview resume after reload');
  app.run("show('pact-setup');setMode('preview')");app.ids['pact-task'].value='Read';app.ids['pact-duration'].value='10';
  app.ids['create-form'].onsubmit({preventDefault(){}});await app.flush();await app.click('cancel-pact');await app.flush();
  assert.match(app.ids['room-title'].textContent,/Another time/);
  console.log('PASS preview cancellation');
  app.run("show('pact-setup')");app.ids['create-form'].onsubmit({preventDefault(){}});await app.flush();
  await app.click('preview-join');app.advance(611);await app.click('refund-pact');await app.flush();
  assert.match(app.ids['room-title'].textContent,/No funds left behind/);
  console.log('PASS preview timeout refund');
  await app.click('wallet-button');assert.match(app.ids.notice.textContent,/one-time build/);
  console.log('PASS unbuilt live mode is blocked explicitly');
  console.log('All 6 app-state test groups passed. This is not visual/browser or Solidity execution testing.');
})().catch(e=>{console.error(e);process.exit(1)});
