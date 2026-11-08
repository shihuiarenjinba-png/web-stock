import test from 'node:test';
import assert from 'node:assert/strict';
import {isConfigured,issueCookie,entitlement,verifiedSubscription,checkoutBrowserState,TEST_MONTHLY_JPY,configurationMissing} from '../server/stripe.js';
import {onRequestPost as checkout} from '../functions/api/checkout.js';
import {onRequestPost as activate} from '../functions/api/activate.js';
import {onRequestGet as verify} from '../functions/api/entitlement.js';
const env={STRIPE_SECRET_KEY:'sk_test_mock_only_123',STRIPE_PRO_PRICE_ID:'price_valid',SESSION_SECRET:'X'.repeat(48),APP_ORIGIN:'http://localhost:8788'};
function request(path,origin='http://localhost:8788',body=null,headers={}){return new Request('http://localhost:8788'+path,{method:body===null?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:body===null?undefined:JSON.stringify(body)})}
const sess={livemode:false,mode:'subscription',status:'complete',payment_status:'paid',metadata:{app:'demand-scope-pro'},subscription:'sub_test123',customer:'cus_test123'};
const sub={livemode:false,status:'active',metadata:{app:'demand-scope-pro'},customer:'cus_test123',items:{data:[{price:{id:'price_valid'}}]}};
test('test-mode-only config',()=>{assert.ok(isConfigured(env));assert.ok(!isConfigured({...env,STRIPE_SECRET_KEY:'sk_live_forbidden'}));assert.ok(!isConfigured({...env,SESSION_SECRET:'short'}))});
test('reject wrong origin before Stripe',async()=>{const res=await checkout({request:request('/api/checkout','https://evil.test',{}),env});assert.equal(res.status,403)});
test('verify unavailable without secrets',async()=>{const res=await verify({request:request('/api/entitlement'),env:{}});assert.deepEqual(await res.json(),{active:false,configured:false,missing:['STRIPE_SECRET_KEY','SESSION_SECRET'],mode:'test'})});
test('checkout uses configured Price ID only',async()=>{const old=globalThis.fetch;try{let seen=null;globalThis.fetch=async(_url,opt)=>{seen=new URLSearchParams(opt.body);return new Response(JSON.stringify({url:'https://checkout.stripe.com/c/pay/mock'}))};const res=await checkout({request:request('/api/checkout',undefined,{}),env});assert.equal(res.status,200);assert.equal(seen.get('line_items[0][price]'),'price_valid');assert.equal(seen.get('mode'),'subscription');assert.match(seen.get('client_reference_id'),/^[A-Za-z0-9_-]{40,50}$/);assert.match(res.headers.get('Set-Cookie'),/demand_checkout=/);assert.match(seen.get('success_url'),/session_id=/)}finally{globalThis.fetch=old}});
test('signed entitlement returns false on tampered cookie, active on valid cookie',async()=>{const old=globalThis.fetch;try{globalThis.fetch=async()=>new Response(JSON.stringify(sub));const cookie=(await issueCookie('sub_test123','cus_test123',env,false)).split(';')[0];assert.ok(await entitlement(request('/api/entitlement',undefined,null,{Cookie:cookie}),env));assert.equal(await entitlement(request('/api/entitlement',undefined,null,{Cookie:cookie+'x'}),env),null);const bad=await verifiedSubscription(env,'sub_test123');assert.equal(bad.status,'active');globalThis.fetch=async()=>new Response(JSON.stringify({...sub,status:'canceled'}));assert.equal(await entitlement(request('/api/entitlement',undefined,null,{Cookie:cookie}),env),null)}finally{globalThis.fetch=old}});
test('checkout activation binds to initiating browser and rejects replay',async()=>{const old=globalThis.fetch;try{
 const start=await checkoutBrowserState(env,false);
 let session={...sess,client_reference_id:start.reference};
 globalThis.fetch=async(url)=>new Response(JSON.stringify(url.includes('/checkout/sessions/')?session:sub));
 const cookie=start.cookie.split(';')[0];
 const res=await activate({request:request('/api/activate',undefined,{session_id:'cs_test_valid_session_123'},{Cookie:cookie}),env});
 assert.equal(res.status,200);assert.match(res.headers.get('Set-Cookie'),/HttpOnly/);
 const replay=await activate({request:request('/api/activate',undefined,{session_id:'cs_test_valid_session_123'}),env});assert.equal(replay.status,403);
 const wrongBrowser=await checkoutBrowserState(env,false);
 const replayOther=await activate({request:request('/api/activate',undefined,{session_id:'cs_test_valid_session_123'},{Cookie:wrongBrowser.cookie.split(';')[0]}),env});assert.equal(replayOther.status,403);
 const err=await activate({request:request('/api/activate','https://evil.test',{session_id:'cs_test_valid_session_123'},{Cookie:cookie}),env});assert.equal(err.status,403);
 }finally{globalThis.fetch=old}});


test('reject malformed or insecure production APP_ORIGIN before Stripe calls',()=>{
 assert.equal(isConfigured({...env,APP_ORIGIN:'https://user:secret@example.com'}),false);
 assert.equal(isConfigured({...env,APP_ORIGIN:'https://example.com/path'}),false);
 assert.equal(isConfigured({...env,APP_ORIGIN:'https://example.com/'}),false);
 assert.equal(isConfigured({...env,APP_ORIGIN:'http://example.com'}),false);
 assert.equal(isConfigured({...env,APP_ORIGIN:'javascript:alert(1)'}),false);
 assert.equal(isConfigured({...env,APP_ORIGIN:'https://demand.example.com'}),true);
 assert.equal(isConfigured({...env,APP_ORIGIN:'http://localhost:8788'}),true);
 assert.equal(isConfigured(null),false);
});

test('inline JPY100 test checkout works without product Price ID or explicit origin',async()=>{
 const simple={STRIPE_SECRET_KEY:'sk_test_mock_only_123',SESSION_SECRET:'Y'.repeat(48)};
 assert.ok(isConfigured(simple));assert.equal(TEST_MONTHLY_JPY,100);assert.deepEqual(configurationMissing(simple),[]);
 const old=globalThis.fetch;let posted;
 try{globalThis.fetch=async(_url,opts)=>{posted=new URLSearchParams(opts.body);return new Response(JSON.stringify({url:'https://checkout.stripe.com/c/pay/test-session'}))};
 const res=await checkout({request:request('/api/checkout',undefined,{}),env:simple});
 assert.equal(res.status,200);assert.equal(posted.get('line_items[0][price_data][unit_amount]'),'100');
 assert.equal(posted.get('line_items[0][price_data][currency]'),'jpy');
 assert.equal(posted.get('line_items[0][price_data][recurring][interval]'),'month');
 assert.equal(posted.get('line_items[0][price]'),null);
 assert.match(posted.get('success_url'),/^http:\/\/localhost:8788\/pro\//);
 }finally{globalThis.fetch=old}
});
test('only this app can authorize inline-price test subscriptions',async()=>{
 const env2={STRIPE_SECRET_KEY:'sk_test_mock_only_123',SESSION_SECRET:'Z'.repeat(48)};
 const old=globalThis.fetch;
 const inline={livemode:false,status:'active',customer:'cus_test123',metadata:{app:'demand-scope-pro'},items:{data:[{price:{currency:'jpy',unit_amount:100,recurring:{interval:'month'}}}]}};
 try{globalThis.fetch=async()=>new Response(JSON.stringify(inline));assert.ok(await verifiedSubscription(env2,'sub_test123'));
 globalThis.fetch=async()=>new Response(JSON.stringify({...inline,metadata:{app:'other'}}));assert.equal(await verifiedSubscription(env2,'sub_test123'),null);
 globalThis.fetch=async()=>new Response(JSON.stringify({...inline,livemode:true}));assert.equal(await verifiedSubscription(env2,'sub_test123'),null);
 globalThis.fetch=async()=>new Response(JSON.stringify({...inline,items:{data:[{price:{currency:'jpy',unit_amount:9800,recurring:{interval:'month'}}}]}}));assert.equal(await verifiedSubscription(env2,'sub_test123'),null);
 }finally{globalThis.fetch=old}
});


test('DemandScope uses dedicated test customer portal configuration',async()=>{
 const {onRequestPost: portal}=await import('../functions/api/portal.js');
 const old=globalThis.fetch;const calls=[];
 try{
   globalThis.fetch=async(url,opts)=>{
      calls.push({url,form:opts?.body?new URLSearchParams(opts.body):null});
      if(url.includes('/subscriptions/'))return new Response(JSON.stringify(sub));
      if(url.includes('/billing_portal/sessions'))return new Response(JSON.stringify({url:'https://billing.stripe.com/p/session_test'}));
      return new Response('{}',{status:404});
   };
   const cookie=(await issueCookie('sub_test123','cus_test123',env,false)).split(';')[0];
   const res=await portal({request:request('/api/portal',undefined,{}, {Cookie:cookie}),env});
   assert.equal(res.status,200);
   const form=calls.find(x=>x.url.includes('/billing_portal/sessions'))?.form;
   assert.equal(form?.get('configuration'),'bpc_1UZ2FNBGa8rL8jwIBPFuUkWT');
   assert.equal(form?.get('return_url'),'http://localhost:8788/pro/');
 }finally{globalThis.fetch=old}
});


test('restricted test API key is allowed; restricted live API key is rejected',async()=>{
 const restricted={...env,STRIPE_SECRET_KEY:'rk_test_sample_restricted_123'};
 assert.equal(isConfigured(restricted),true);
 assert.equal(isConfigured({...restricted,STRIPE_SECRET_KEY:'rk_live_never_allowed_123'}),false);
 assert.equal(configurationMissing(restricted).length,0);
 const old=globalThis.fetch;let seenHeader='';
 try {
   globalThis.fetch=async (_url,opts)=>{seenHeader=opts.headers.Authorization;return new Response(JSON.stringify({url:'https://checkout.stripe.com/c/pay/mock'}))};
   const res=await checkout({request:request('/api/checkout',undefined,{}),env:restricted});
   assert.equal(res.status,200);
   assert.equal(seenHeader,'Bearer rk_test_sample_restricted_123');
 }finally{globalThis.fetch=old}
});


test('Stripe API errors preserve safe diagnostic fields without exposing credentials',async()=>{
 const old=globalThis.fetch;
 try{
  globalThis.fetch=async()=>new Response(JSON.stringify({error:{type:'invalid_request_error',code:'permission_missing',message:'This API key does not have permission to perform this request.',param:null}}),{status:403,headers:{'request-id':'req_test_diag_123','content-type':'application/json'}});
  const res=await checkout({request:request('/api/checkout',undefined,{}),env:{STRIPE_SECRET_KEY:'rk_test_restricted_diag',SESSION_SECRET:'D'.repeat(48)}});
  assert.equal(res.status,502);const body=await res.json();
  assert.equal(body.stripe_code,'permission_missing');assert.equal(body.request_id,'req_test_diag_123');assert.match(body.hint,/Checkout Sessions/);assert.ok(!JSON.stringify(body).includes('rk_test_restricted_diag'));
 }finally{globalThis.fetch=old}
});
test('stripe-status safely reports restricted-key permission failure',async()=>{
 const {onRequestGet:status}=await import('../functions/api/stripe-status.js');
 const old=globalThis.fetch;
 try{
  globalThis.fetch=async()=>new Response(JSON.stringify({error:{type:'invalid_request_error',message:'permission denied'}}),{status:403,headers:{'request-id':'req_health_123','content-type':'application/json'}});
  const res=await status({env:{STRIPE_SECRET_KEY:'rk_test_status_diag',SESSION_SECRET:'E'.repeat(48)}});const body=await res.json();
  assert.equal(body.configured,true);assert.equal(body.reachable,false);assert.equal(body.key_type,'restricted_test');assert.equal(body.request_id,'req_health_123');assert.ok(!JSON.stringify(body).includes('rk_test_status_diag'));
 }finally{globalThis.fetch=old}
});
