import test from 'node:test';
import assert from 'node:assert/strict';
import {magicLinkConfig,createMagicLink,consumeMagicLink,normalizeEmail} from '../server/magic-link.js';
import {onRequestPost as requestMagic} from '../functions/api/magic-link/request.js';

class FakeDB{
 constructor(){this.tokens=new Map()}
 prepare(sql){
  const db=this;
  return {bind(...args){return {
   async first(){
    if(sql.startsWith('SELECT COUNT(*) AS n FROM magic_link_tokens'))return {n:db.tokens.size};
    if(sql.startsWith('SELECT email,stripe_customer_id')){const row=db.tokens.get(args[0]);return row?{email:row.email,stripe_customer_id:row.customer,stripe_subscription_id:row.subscription,expires_at:row.expires,used_at:row.usedAt}:null}
    return null;
   },
   async run(){
    if(sql.startsWith('DELETE FROM magic_link_tokens')){const now=args[0];for(const [k,v] of db.tokens)if(v.expires<=now)db.tokens.delete(k);return {meta:{changes:0}}}
    if(sql.startsWith('INSERT INTO magic_link_tokens')){const [hash,email,emailHash,customer,subscription,expires]=args;db.tokens.set(hash,{hash,email,emailHash,customer,subscription,expires,usedAt:null,sendError:null});return {meta:{changes:1}}}
    if(sql.startsWith('UPDATE magic_link_tokens SET send_error=')){const [error,hash]=args;const row=db.tokens.get(hash);if(row)row.sendError=error;return {meta:{changes:row?1:0}}}
    if(sql.startsWith('UPDATE magic_link_tokens SET used_at=')){const [email,hash,now]=args;const row=db.tokens.get(hash);if(!row||row.usedAt||row.expires<=now)return {meta:{changes:0}};row.usedAt='now';row.email=email;return {meta:{changes:1}}}
    return {meta:{changes:0}};
   }
  }}}
 }
}
const baseEnv={
 STRIPE_SECRET_KEY:'sk_test_magic_mock_123',
 STRIPE_PRO_PRICE_ID:'price_valid',
 SESSION_SECRET:'M'.repeat(48),
 APP_ORIGIN:'http://localhost:8788',
 MAGIC_LINK_ENABLED:'true',
 MAGIC_LINK_FROM:'noreply@example.com',
 CLOUDFLARE_EMAIL_ACCOUNT_ID:'a'.repeat(32),
 CLOUDFLARE_EMAIL_API_TOKEN:'token_'+('x'.repeat(30))
};
const customer={id:'cus_magic123'};
const subscription={id:'sub_magic123',livemode:false,status:'active',metadata:{app:'demand-scope-pro'},customer:customer.id,items:{data:[{price:{id:'price_valid'}}]}};
function req(email){return new Request('http://localhost:8788/api/magic-link/request',{method:'POST',headers:{Origin:'http://localhost:8788','Content-Type':'application/json'},body:JSON.stringify({email})})}

test('magic link sender requires owned-style domain and explicit enablement',()=>{
 assert.equal(magicLinkConfig({...baseEnv,DB:new FakeDB()}).configured,true);
 assert.equal(magicLinkConfig({...baseEnv,DB:new FakeDB(),MAGIC_LINK_FROM:'noreply@web-stock.pages.dev'}).configured,false);
 assert.equal(magicLinkConfig({...baseEnv,DB:new FakeDB(),MAGIC_LINK_ENABLED:'false'}).configured,false);
 assert.equal(normalizeEmail(' BUYER@Example.com '),'buyer@example.com');
});

test('magic link stores only token hash and is single-use',async()=>{
 const db=new FakeDB(),env={...baseEnv,DB:db};let emailed=null;
 const old=globalThis.fetch;
 try{
  globalThis.fetch=async(url,opt)=>{
   const s=String(url);
   if(s.includes('/v1/customers?'))return new Response(JSON.stringify({data:[customer]}));
   if(s.includes('/v1/subscriptions?'))return new Response(JSON.stringify({data:[subscription]}));
   if(s.includes('/v1/subscriptions/sub_magic123'))return new Response(JSON.stringify(subscription));
   if(s.includes('/email/sending/send')){emailed=JSON.parse(opt.body);return new Response(JSON.stringify({success:true,result:{id:'msg_1'}}))}
   throw new Error('unexpected '+s);
  };
  const created=await createMagicLink(env,'buyer@example.com',req('buyer@example.com'));
  assert.equal(created.sent,true);assert.ok(emailed);
  const raw=new URL(emailed.text.match(/https?:\/\/\S+/)[0]).searchParams.get('token');
  assert.match(raw,/^[A-Za-z0-9_-]{40,60}$/);
  assert.equal(db.tokens.has(raw),false);
  assert.equal(db.tokens.size,1);
  const access=await consumeMagicLink(env,raw);
  assert.equal(access.customer,'cus_magic123');assert.equal(access.subscription,'sub_magic123');
  assert.equal(await consumeMagicLink(env,raw),null);
 }finally{globalThis.fetch=old}
});

test('magic-link request does not reveal whether a Stripe subscription exists',async()=>{
 const old=globalThis.fetch;
 try{
  const env={...baseEnv,DB:new FakeDB()};
  globalThis.fetch=async(url)=>{
   const s=String(url);
   if(s.includes('/v1/customers?'))return new Response(JSON.stringify({data:[]}));
   throw new Error('unexpected '+s);
  };
  const res=await requestMagic({request:req('nobody@example.com'),env});
  assert.equal(res.status,202);const body=await res.json();
  assert.equal(body.ok,true);assert.equal('sent' in body,false);assert.match(body.message,/有効なDemandScope Pro契約が確認できる場合/);
 }finally{globalThis.fetch=old}
});
