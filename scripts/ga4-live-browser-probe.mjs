import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const base = await mkdtemp(path.join(tmpdir(), 'ga4-cdp-'));
const port = 9307;
const browserBinary = process.env.CHROME_BIN || '/usr/bin/google-chrome';
const chrome = spawn(browserBinary, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=' + port,
  '--remote-allow-origins=*', '--user-data-dir=' + base, 'about:blank'
], { stdio: 'ignore' });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const requests = [];
const failures = [];
const responses = [];
const finished = [];
const exceptions = [];
let socket = null;

try {
  let tab;
  for (let n = 0; n < 80; n++) {
    try {
      const resp = await fetch('http://127.0.0.1:' + port + '/json/list');
      const tabs = await resp.json();
      tab = tabs.find(x => x.type === 'page' && x.webSocketDebuggerUrl);
      if (tab) break;
    } catch {}
    await sleep(250);
  }
  if (!tab) throw new Error('No Chrome debugging tab available');

  socket = new WebSocket(tab.webSocketDebuggerUrl);
  const pending = new Map();
  let counter = 1;
  socket.addEventListener('message', ev => {
    const payload = JSON.parse(String(ev.data));
    if (payload.id && pending.has(payload.id)) {
      const fn = pending.get(payload.id);
      pending.delete(payload.id);
      fn(payload);
    }
    if (payload.method === 'Network.requestWillBeSent') {
      const url = payload.params.request?.url || '';
      if (/googletagmanager|google-analytics|doubleclick|pagero\.kr/i.test(url)) {
        requests.push({ id:payload.params.requestId, url:url.slice(0,230), resourceType:payload.params.type || '' });
      }
    }
    if (payload.method === 'Network.responseReceived' && (payload.params.response?.url || '').includes('google-analytics.com/') && (payload.params.response?.url || '').includes('collect')) responses.push({id:payload.params.requestId,status:payload.params.response.status,url:payload.params.response.url.slice(0,110)});
    if (payload.method === 'Network.loadingFinished') finished.push(payload.params.requestId);
    if (payload.method === 'Network.loadingFailed') failures.push({ id:payload.params.requestId, reason:payload.params.errorText, blocked:payload.params.blockedReason });
    if (payload.method === 'Runtime.exceptionThrown') exceptions.push(payload.params.exceptionDetails?.text || 'exception');
  });
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, {once:true});
    socket.addEventListener('error', reject, {once:true});
  });
  async function send(method, params={}) {
    const id = counter++;
    const answer = new Promise(resolve=> pending.set(id,resolve));
    socket.send(JSON.stringify({id,method,params}));
    const payload=await answer;
    if(payload.error)throw new Error(method+': '+JSON.stringify(payload.error));
    return payload.result || {};
  }
  await send('Page.enable');
  await send('Network.enable');
  await send('Runtime.enable');
  const target = process.env.PROBE_URL || 'https://pagero.kr/';
  await send('Page.navigate',{url:target});
  await sleep(11000);
  const check = await send('Runtime.evaluate',{expression:"({host:location.hostname,path:location.pathname,ga4:document.documentElement.innerHTML.includes('G-501Z526B8H'),gtag:typeof window.gtag,ds:window.dataLayer?.length})",returnByValue:true});
  const ga4js = requests.some(x=>x.url.includes('gtag/js?id=G-501Z526B8H'));
  const ga4collect = requests.some(x=>/google-analytics\.com\/(?:g\/)?collect/.test(x.url));
  console.log('Target: '+target);
  console.log('Browser state:',JSON.stringify(check.result?.value));
  console.log('GA4 JS fetched:',ga4js);
  console.log('GA4 collect requested:',ga4collect);
  console.log('Network:',JSON.stringify(requests));
  console.log('GA4 collect responses:',JSON.stringify(responses));
  console.log('GA4 collect completed:',JSON.stringify(responses.map(x=>({id:x.id,completed:finished.includes(x.id)}))));
  console.log('Failures:',JSON.stringify(failures));
  console.log('Exceptions:',JSON.stringify(exceptions.slice(0,12)));
  if(!ga4collect)process.exitCode=1;
} catch(e) {
  console.error(e);
  process.exitCode=1;
} finally {
  if(socket)socket.close();
  chrome.kill('SIGKILL');
  await rm(base,{recursive:true,force:true}).catch(()=>{});
}
