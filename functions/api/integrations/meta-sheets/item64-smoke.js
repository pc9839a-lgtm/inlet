// Temporary single-use production egress probe. Delete after collecting result.
// Never accepts user data, arbitrary URLs, or arbitrary campaigns.
import { assertD1 } from '../../_shared.js';
import { advertiserForm } from './relay.js';

const NONCE_HASH='5e5d3d3745c5a24f3f96afb9781d1188c6fe2b513340f44c5cc155dbc1c85b5d';
const RUN_ID='item64-20261111-single-server-smoke';
const ENDPOINT='https://ollymkt.shop/dbapi/';
const EXPIRES=Date.parse('2026-11-11T10:00:00Z');

function reply(status, payload) {
  return new Response(JSON.stringify(payload),{
    status,
    headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}
  });
}

async function digest(value) {
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

export async function onRequestGet({ request, env }) {
  if (Date.now()>EXPIRES) return reply(410,{error:'SMOKE_EXPIRED'});
  const token=new URL(request.url).searchParams.get('k')||'';
  if (token.length<32 || token.length>100 || await digest(token)!==NONCE_HASH)
    return reply(404,{error:'NOT_FOUND'});

  const db=assertD1(env);
  await db.prepare('CREATE TABLE IF NOT EXISTS meta_sheet_smoke_once (id TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)').run();
  // Atomic one-shot claim: never register more than a single test lead, even if retried.
  const claimed=await db.prepare('INSERT OR IGNORE INTO meta_sheet_smoke_once(id) VALUES (?)')
    .bind(RUN_ID).run();
  if (!claimed.meta?.changes) return reply(409,{smokeId:RUN_ID,error:'ALREADY_EXECUTED'});

  const synthetic={
    name:'INTEGRATION TEST DO NOT CONTACT',
    phone:'01000000000',
    money:'TEST ONLY',
    calldate:'TEST ONLY',
    content:'CLOUDFLARE ITEM64 EGRESS SMOKE TEST - NOT A CUSTOMER'
  };
  const form=advertiserForm(synthetic);
  const keys=[...new URLSearchParams(form).keys()];
  const started=Date.now();
  try {
    const result=await fetch(ENDPOINT,{
      method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:form,
      redirect:'follow',
      signal:AbortSignal.timeout(12000)
    });
    const txt=(await result.text()).slice(0,100);
    const headers={
      server:result.headers.get('server')||'',
      cfRay:result.headers.get('cf-ray')||'',
      contentType:result.headers.get('content-type')||''
    };
    return reply(200,{
      smokeId:RUN_ID,executed:true,source:'Cloudflare Pages Function',
      item:'64',keys,phoneFormat:'010XXXXXXXX',synthetic:true,
      advertiserHttpStatus:result.status,body:txt,headers,
      elapsedMs:Date.now()-started
    });
  }catch(err){
    return reply(200,{
      smokeId:RUN_ID,executed:true,source:'Cloudflare Pages Function',
      item:'64',keys,synthetic:true,
      networkError:String(err?.name||'Error').slice(0,80),
      networkCode:String(err?.cause?.code||'').slice(0,80),
      elapsedMs:Date.now()-started
    });
  }
}
