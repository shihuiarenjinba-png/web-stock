import test from 'node:test';
import assert from 'node:assert/strict';
import {isConfigured,issueCookie,entitlement,verifiedSubscription,checkoutBrowserState,TEST_MONTHLY_JPY,configurationMissing} from '../server/stripe.js';
import {onRequestPost as checkout} from '../functions/api/checkout.js';
import {onRequestPost as activate} from '../functions/api/activate.js';
import {onRequestGet as verify} from '../functions/api/entitlement.js';
import {authConfigured,beginGoogleLogin,issueMemberCookie} from '../server/auth.js';
const env={STRIPE_SECRET_KEY:'sk_test_mock_only_123',STRIPE_PRO_PRICE_ID:'price_valid',SESSION_SECRET:'X'.repeat(48),APP_ORIGIN:'http://localhost:8788'};
function request(path,origin='http://localhost:8788',body=null,headers={}){return new Request('http://localhost:8788'+path,{method:body===null?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:body===null?undefined:JSON.stringify(body)})}
const sess={livemode:false,mode:'subscription',status:'complete',payment_status:'paid',metadata:{app:'demand-scope-pro'},subscription:'sub_test123',customer:'cus_test123'};
const sub={livemode:false,status:'active',metadata:{app:'demand-scope-pro'},customer:'cus_test123',items:{data:[{price:{id:'price_valid'}}]}};
test('test-mode-only config',()=>{assert.ok(isConfigured(env));assert.ok(!isConfigured({...env,STRIPE_SECRET_KEY:'sk_live_forbidden'}));assert.ok(!isConfigured({...env,SESSION_SECRET:'short'}))});
test('reject wrong origin before Stripe',async()=>{const res=await checkout({request:request('/api/checkout','https://evil.test',{}),env});assert.equal(res.status,403)});
test('same-origin checkout is not blocked by a stale APP_ORIGIN override',async()=>{
 const old=globalThis.fetch;let posted;
 try{
  globalThis.fetch=async(_url,opt)=>{posted=new URLSearchParams(opt.body);return new Response(JSON.stringify({url:'https://checkout.stripe.com/c/pay/origin-fix'}))};
  const stale={...env,APP_ORIGIN:'https://stale.example.com'};
  const res=await checkout({request:request('/api/checkout','http://localhost:8788',{accept_terms:true}),env:stale});
  assert.equal(res.status,200);
  assert.match(posted.get('success_url'),/^http:\/\/localhost:8788\/pro\//);
  assert.match(posted.get('cancel_url'),/^http:\/\/localhost:8788\/pro\//);
 }finally{globalThis.fetch=old}
});
test('same-origin Referer is accepted when browser omits Origin',async()=>{
 const old=globalThis.fetch;
 try{
  globalThis.fetch=async()=>new Response(JSON.stringify({url:'https://checkout.stripe.com/c/pay/referer-fix'}));
  const req=new Request('http://localhost:8788/api/checkout',{method:'POST',headers:{Referer:'http://localhost:8788/pro/','Content-Type':'application/json'},body:JSON.stringify({accept_terms:true})});
  const res=await checkout({request:req,env});
  assert.equal(res.status,200);
 }finally{globalThis.fetch=old}
});
test('verify unavailable without secrets',async()=>{const res=await verify({request:request('/api/entitlement'),env:{}});const body=await res.json();assert.equal(body.active,false);assert.equal(body.configured,false);assert.deepEqual(body.missing,['STRIPE_SECRET_KEY','SESSION_SECRET']);assert.deepEqual(body.issues,[{name:'STRIPE_SECRET_KEY',reason:'missing'},{name:'SESSION_SECRET',reason:'missing'}]);assert.equal(body.mode,'test')});
test('checkout uses configured Price ID only',async()=>{const old=globalThis.fetch;try{let seen=null;globalThis.fetch=async(_url,opt)=>{seen=new URLSearchParams(opt.body);return new Response(JSON.stringify({url:'https://checkout.stripe.com/c/pay/mock'}))};const res=await checkout({request:request('/api/checkout',undefined,{accept_terms:true}),env});assert.equal(res.status,200);assert.equal(seen.get('line_items[0][price]'),'price_valid');assert.equal(seen.get('mode'),'subscription');assert.equal(seen.get('wallet_options[link][display]'),'never');assert.match(seen.get('client_reference_id'),/^[A-Za-z0-9_-]{40,50}$/);assert.match(res.headers.get('Set-Cookie'),/demand_checkout=/);assert.match(seen.get('success_url'),/session_id=/)}finally{globalThis.fetch=old}});
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
 const res=await checkout({request:request('/api/checkout',undefined,{accept_terms:true}),env:simple});
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
   const res=await checkout({request:request('/api/checkout',undefined,{accept_terms:true}),env:restricted});
   assert.equal(res.status,200);
   assert.equal(seenHeader,'Bearer rk_test_sample_restricted_123');
 }finally{globalThis.fetch=old}
});


test('Stripe API errors preserve safe diagnostic fields without exposing credentials',async()=>{
 const old=globalThis.fetch;
 try{
  globalThis.fetch=async()=>new Response(JSON.stringify({error:{type:'invalid_request_error',code:'permission_missing',message:'This API key does not have permission to perform this request.',param:null}}),{status:403,headers:{'request-id':'req_test_diag_123','content-type':'application/json'}});
  const res=await checkout({request:request('/api/checkout',undefined,{accept_terms:true}),env:{STRIPE_SECRET_KEY:'rk_test_restricted_diag',SESSION_SECRET:'D'.repeat(48)}});
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


test('configuration diagnostics distinguish missing, short session and wrong Stripe key format',async()=>{
 const {configurationDiagnostics}=await import('../server/stripe.js');
 assert.deepEqual(configurationDiagnostics({}).map(x=>[x.name,x.reason]),[['STRIPE_SECRET_KEY','missing'],['SESSION_SECRET','missing']]);
 assert.ok(configurationDiagnostics({STRIPE_SECRET_KEY:'rk_test_ok',SESSION_SECRET:'short'}).some(x=>x.name==='SESSION_SECRET'&&x.reason==='too_short'));
 assert.ok(configurationDiagnostics({STRIPE_SECRET_KEY:'rk_live_not_allowed',SESSION_SECRET:'X'.repeat(40)}).some(x=>x.name==='STRIPE_SECRET_KEY'&&x.reason==='test_key_format'));
 assert.equal(configurationDiagnostics({STRIPE_SECRET_KEY:'rk_test_ok',SESSION_SECRET:'X'.repeat(40)}).length,0);
});


test('Stripe secret values tolerate surrounding whitespace but not assignment-style paste',async()=>{
 const {configurationDiagnostics,isConfigured}=await import('../server/stripe.js');
 assert.equal(isConfigured({STRIPE_SECRET_KEY:'  rk_test_ok_123  ',SESSION_SECRET:'  '+'S'.repeat(40)+'  '}),true);
 const issues=configurationDiagnostics({STRIPE_SECRET_KEY:'STRIPE_SECRET_KEY=rk_test_bad',SESSION_SECRET:'S'.repeat(40)});
 assert.ok(issues.some(x=>x.name==='STRIPE_SECRET_KEY'&&x.reason==='pasted_assignment'));
});
test('Stripe Authorization uses normalized secret value',async()=>{
 const old=globalThis.fetch;let auth='';
 try{
  globalThis.fetch=async(_url,opt)=>{auth=opt.headers.Authorization;return new Response(JSON.stringify({url:'https://checkout.stripe.com/c/pay/mock'}))};
  const trimmed={STRIPE_SECRET_KEY:'  rk_test_trimmed_123  ',SESSION_SECRET:'  '+'T'.repeat(40)+'  '};
  const res=await checkout({request:request('/api/checkout',undefined,{accept_terms:true}),env:trimmed});
  assert.equal(res.status,200);assert.equal(auth,'Bearer rk_test_trimmed_123');
 }finally{globalThis.fetch=old}
});


test('checkout refuses to start without explicit legal consent',async()=>{
 const res=await checkout({request:request('/api/checkout',undefined,{accept_terms:false}),env});
 assert.equal(res.status,400);assert.match((await res.json()).error,/同意/);
});
test('checkout records legal version and accepted timestamp in Stripe metadata',async()=>{
 const old=globalThis.fetch;let form;
 try{
  globalThis.fetch=async(_url,opt)=>{form=new URLSearchParams(opt.body);return new Response(JSON.stringify({url:'https://checkout.stripe.com/c/pay/legal'}))};
  const res=await checkout({request:request('/api/checkout',undefined,{accept_terms:true}),env});
  assert.equal(res.status,200);
  assert.equal(form.get('metadata[legal_version]'),'2026-11-08');
  assert.equal(form.get('subscription_data[metadata][legal_version]'),'2026-11-08');
  assert.match(form.get('metadata[legal_accepted_at]'),/^\d{10}$/);
 }finally{globalThis.fetch=old}
});


function memberDb(member={id:'member_12345678',email:'buyer@example.com',stripe_customer_id:null},subscription=null){
 return {prepare(sql){return {bind(){return {first:async()=>{
  if(sql.includes('FROM members WHERE id='))return member;
  if(sql.includes('FROM subscriptions WHERE member_id='))return subscription;
  return null;
 }}}}}};
}
test('Google OIDC foundation emits state+PKCE redirect only when D1 and credentials exist',async()=>{
 const authEnv={...env,DB:memberDb(),GOOGLE_CLIENT_ID:'client.apps.googleusercontent.com',GOOGLE_CLIENT_SECRET:'secret'};
 assert.equal(authConfigured(authEnv),true);assert.equal(authConfigured({...authEnv,DB:null}),false);
 const out=await beginGoogleLogin(request('/api/auth/login'),authEnv),u=new URL(out.url);
 assert.equal(u.origin,'https://accounts.google.com');assert.equal(u.searchParams.get('response_type'),'code');
 assert.equal(u.searchParams.get('redirect_uri'),'http://localhost:8788/api/auth/callback');
 assert.equal(u.searchParams.get('code_challenge_method'),'S256');assert.match(out.cookie,/HttpOnly/);
});
test('AUTH_REQUIRED blocks Checkout until a member is signed in',async()=>{
 const authEnv={...env,DB:memberDb(),GOOGLE_CLIENT_ID:'client.apps.googleusercontent.com',GOOGLE_CLIENT_SECRET:'secret',AUTH_REQUIRED:'true'};
 const res=await checkout({request:request('/api/checkout',undefined,{accept_terms:true}),env:authEnv});
 assert.equal(res.status,401);assert.match((await res.json()).error,/Google/);
});
test('authenticated member is attached to Stripe Checkout metadata and email',async()=>{
 const db=memberDb(),authEnv={...env,DB:db,GOOGLE_CLIENT_ID:'client.apps.googleusercontent.com',GOOGLE_CLIENT_SECRET:'secret',AUTH_REQUIRED:'true'};
 const baseReq=request('/api/auth/me'),setCookie=await issueMemberCookie('member_12345678',baseReq,authEnv),cookie=setCookie.split(';')[0];
 const old=globalThis.fetch;let form;
 try{
  globalThis.fetch=async(_url,opt)=>{form=new URLSearchParams(opt.body);return new Response(JSON.stringify({url:'https://checkout.stripe.com/c/pay/member'}))};
  const res=await checkout({request:request('/api/checkout',undefined,{accept_terms:true},{Cookie:cookie}),env:authEnv});
  assert.equal(res.status,200);assert.equal(form.get('metadata[member_id]'),'member_12345678');assert.equal(form.get('subscription_data[metadata][member_id]'),'member_12345678');assert.equal(form.get('customer_email'),'buyer@example.com');
 }finally{globalThis.fetch=old}
});
test('AUTH_REQUIRED entitlement uses member-linked D1 subscription and re-verifies with Stripe',async()=>{
 const row={stripe_subscription_id:'sub_test123',stripe_customer_id:'cus_test123',status:'active'};
 const db=memberDb(undefined,row),authEnv={...env,DB:db,GOOGLE_CLIENT_ID:'client.apps.googleusercontent.com',GOOGLE_CLIENT_SECRET:'secret',AUTH_REQUIRED:'true'};
 const setCookie=await issueMemberCookie('member_12345678',request('/api/auth/me'),authEnv),cookie=setCookie.split(';')[0];
 const old=globalThis.fetch;
 try{globalThis.fetch=async()=>new Response(JSON.stringify(sub));const res=await verify({request:request('/api/entitlement',undefined,null,{Cookie:cookie}),env:authEnv});const body=await res.json();assert.equal(body.active,true);assert.equal(body.status,'active')}
 finally{globalThis.fetch=old}
});
