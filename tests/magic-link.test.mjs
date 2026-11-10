import test from 'node:test';
import assert from 'node:assert/strict';
import {authMailGatewayConfig,signedGatewayRequest,gatewayHealth} from '../server/auth-mail-gateway.js';
import {normalizeEmail} from '../server/subscription-lookup.js';
import {onRequestPost as requestMagic} from '../functions/api/magic-link/request.js';
import {onRequestGet as callbackMagic} from '../functions/api/magic-link/callback.js';
import {onRequestGet as statusMagic} from '../functions/api/magic-link/status.js';

const env={
 STRIPE_SECRET_KEY:'sk_test_magic_mock_123',
 STRIPE_PRO_PRICE_ID:'price_valid',
 SESSION_SECRET:'M'.repeat(48),
 APP_ORIGIN:'http://localhost:8788',
 AUTH_MAIL_GATEWAY_URL:'https://auth.example.com',
 AUTH_MAIL_APP_ID:'demandscope',
 AUTH_MAIL_APP_SECRET:'G'.repeat(48)
};
const customer={id:'cus_magic123'};
const subscription={id:'sub_magic123',livemode:false,status:'active',metadata:{app:'demand-scope-pro'},customer:customer.id,items:{data:[{price:{id:'price_valid'}}]}};
function browserRequest(path,body=null){return new Request('http://localhost:8788'+path,{method:body===null?'GET':'POST',headers:body===null?{}:{Origin:'http://localhost:8788','Content-Type':'application/json'},body:body===null?undefined:JSON.stringify(body)})}

test('gateway configuration is explicit and cross-account safe',()=>{
 assert.equal(authMailGatewayConfig(env).configured,true);
 assert.equal(authMailGatewayConfig({...env,AUTH_MAIL_GATEWAY_URL:'https://auth.example.com/path'}).configured,false);
 assert.equal(authMailGatewayConfig({...env,AUTH_MAIL_APP_SECRET:'short'}).configured,false);
 assert.equal(normalizeEmail(' BUYER@Example.com '),'buyer@example.com');
});

test('signed gateway request sends no Stripe secret and signs only server-to-server headers',async()=>{
 const req=await signedGatewayRequest(env,'/v1/magic-link/request',{email:'buyer@example.com'});
 assert.equal(req.url,'https://auth.example.com/v1/magic-link/request');
 assert.equal(req.options.headers['x-auth-mail-app'],'demandscope');
 assert.match(req.options.headers['x-auth-mail-signature'],/^[a-f0-9]{64}$/);
 assert.ok(!req.options.body.includes('sk_test_'));
 assert.ok(!JSON.stringify(req.options.headers).includes(env.STRIPE_SECRET_KEY));
});

test('public request does not reveal whether a Stripe subscription exists',async()=>{
 const old=globalThis.fetch;
 try{
  let gatewayCalls=0;
  globalThis.fetch=async(url,opt)=>{
   const s=String(url);
   if(s.includes('api.stripe.com/v1/customers?'))return new Response(JSON.stringify({data:[]}));
   if(s.startsWith('https://auth.example.com/')){gatewayCalls++;return new Response(JSON.stringify({accepted:true}),{status:202,headers:{'content-type':'application/json'}})}
   throw new Error('unexpected '+s);
  };
  const res=await requestMagic({request:browserRequest('/api/magic-link/request',{email:'nobody@example.com'}),env});
  assert.equal(res.status,202);const body=await res.json();
  assert.equal(body.ok,true);assert.equal(gatewayCalls,0);assert.match(body.message,/有効なDemandScope Pro契約が確認できる場合/);
 }finally{globalThis.fetch=old}
});

test('active Stripe subscription triggers the shared gateway',async()=>{
 const old=globalThis.fetch;let gatewayRequest=null;
 try{
  globalThis.fetch=async(url,opt)=>{
   const s=String(url);
   if(s.includes('api.stripe.com/v1/customers?'))return new Response(JSON.stringify({data:[customer]}));
   if(s.includes('api.stripe.com/v1/subscriptions?'))return new Response(JSON.stringify({data:[subscription]}));
   if(s.includes('api.stripe.com/v1/subscriptions/sub_magic123'))return new Response(JSON.stringify(subscription));
   if(s==='https://auth.example.com/v1/magic-link/request'){gatewayRequest={headers:opt.headers,body:JSON.parse(opt.body)};return new Response(JSON.stringify({accepted:true,expires_in_seconds:600}),{status:202,headers:{'content-type':'application/json'}})}
   throw new Error('unexpected '+s);
  };
  const res=await requestMagic({request:browserRequest('/api/magic-link/request',{email:'buyer@example.com'}),env});
  assert.equal(res.status,202);assert.equal(gatewayRequest.body.email,'buyer@example.com');assert.equal(gatewayRequest.headers['x-auth-mail-app'],'demandscope');
 }finally{globalThis.fetch=old}
});

test('callback consumes gateway assertion then re-verifies Stripe before issuing Pro cookie',async()=>{
 const old=globalThis.fetch;
 try{
  globalThis.fetch=async(url,opt)=>{
   const s=String(url);
   if(s==='https://auth.example.com/v1/assertion/consume')return new Response(JSON.stringify({verified:true,email:'buyer@example.com',verified_at:Date.now()}),{status:200,headers:{'content-type':'application/json'}});
   if(s.includes('api.stripe.com/v1/customers?'))return new Response(JSON.stringify({data:[customer]}));
   if(s.includes('api.stripe.com/v1/subscriptions?'))return new Response(JSON.stringify({data:[subscription]}));
   if(s.includes('api.stripe.com/v1/subscriptions/sub_magic123'))return new Response(JSON.stringify(subscription));
   throw new Error('unexpected '+s);
  };
  const code='A'.repeat(43);
  const res=await callbackMagic({request:browserRequest('/api/magic-link/callback?code='+code),env});
  assert.equal(res.status,302);assert.match(res.headers.get('Location'),/\/pro\/\?magic=ok$/);
  assert.match(res.headers.get('Set-Cookie'),/demand_pro=/);
 }finally{globalThis.fetch=old}
});

test('status exposes recovery only when gateway health is ready',async()=>{
 const old=globalThis.fetch;
 try{
  globalThis.fetch=async url=>new Response(JSON.stringify({service:'auth-mail-gateway',ready:true,sender_domain:'example.com',email_provider:'binding',configured_apps:1}),{status:200,headers:{'content-type':'application/json'}});
  const health=await gatewayHealth(env);assert.equal(health.ready,true);
  const res=await statusMagic({env});const body=await res.json();assert.equal(body.available,true);assert.equal(body.provider,'auth-mail-gateway');
 }finally{globalThis.fetch=old}
});
