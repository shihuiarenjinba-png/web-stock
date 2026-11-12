import test from 'node:test';
import assert from 'node:assert/strict';
import {isConfigured,issueCookie,entitlement,verifiedSubscription,checkoutBrowserState,TEST_MONTHLY_JPY,LIVE_MONTHLY_JPY,configurationMissing,billingMode,activePriceId,expectedLivemode,validateLivePriceObject,verifyLivePrice} from '../server/stripe.js';
import {onRequestPost as checkout} from '../functions/api/checkout.js';
import {onRequestPost as activate} from '../functions/api/activate.js';
import {onRequestGet as verify} from '../functions/api/entitlement.js';
import {subscriptionMutationFromEvent,checkoutAcceptanceFromEvent} from '../server/subscription-store.js';
import {onRequestGet as portalLogin,portalLoginUrl,DEFAULT_TEST_PORTAL_LOGIN} from '../functions/api/portal-login.js';
const env={STRIPE_SECRET_KEY:'sk_test_mock_only_123',STRIPE_PRO_PRICE_ID:'price_valid',SESSION_SECRET:'X'.repeat(48),APP_ORIGIN:'http://localhost:8788'};
function request(path,origin='http://localhost:8788',body=null,headers={}){return new Request('http://localhost:8788'+path,{method:body===null?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:body===null?undefined:JSON.stringify(body)})}
const sess={livemode:false,mode:'subscription',status:'complete',payment_status:'paid',metadata:{app:'demand-scope-pro'},subscription:'sub_test123',customer:'cus_test123'};
const sub={livemode:false,status:'active',metadata:{app:'demand-scope-pro'},customer:'cus_test123',items:{data:[{price:{id:'price_valid'}}]}};
test('billing defaults to TEST and LIVE requires an explicit gate, live key and live Price',()=>{assert.equal(billingMode(env),'test');assert.ok(isConfigured(env));assert.ok(!isConfigured({...env,STRIPE_SECRET_KEY:'sk_live_forbidden'}));assert.ok(!isConfigured({...env,SESSION_SECRET:'short'}));const live={LIVE_BILLING_ENABLED:'true',STRIPE_LIVE_SECRET_KEY:'sk_live_mock_123',STRIPE_LIVE_PRO_PRICE_ID:'price_live123',SESSION_SECRET:'L'.repeat(48),APP_ORIGIN:'https://example.com'};assert.equal(billingMode(live),'live');assert.equal(expectedLivemode(live),true);assert.equal(activePriceId(live),'price_live123');assert.ok(isConfigured(live));assert.ok(!isConfigured({...live,STRIPE_LIVE_PRO_PRICE_ID:''}));assert.ok(!isConfigured({...live,STRIPE_LIVE_SECRET_KEY:'sk_test_wrong'}))});
test('live price validator requires active DemandScope Pro JPY 980 monthly',()=>{
 const good={id:'price_live123',livemode:true,active:true,currency:'jpy',unit_amount:LIVE_MONTHLY_JPY,recurring:{interval:'month',interval_count:1},product:{active:true,metadata:{app:'demand-scope-pro',tier:'pro'}}};
 assert.equal(validateLivePriceObject(good).ok,true);
 assert.equal(validateLivePriceObject({...good,unit_amount:981}).reason,'amount');
 assert.equal(validateLivePriceObject({...good,currency:'usd'}).reason,'currency');
 assert.equal(validateLivePriceObject({...good,recurring:{interval:'year',interval_count:1}}).reason,'interval');
 assert.equal(validateLivePriceObject({...good,product:{active:true,metadata:{app:'other',tier:'pro'}}}).reason,'product_metadata');
});
test('reject wrong origin before Stripe',async()=>{const res=await checkout({request:request('/api/checkout','https://evil.test',{}),env});assert.equal(res.status,403)});
test('configured APP_ORIGIN blocks checkout from an alternate host',async()=>{
 const old=globalThis.fetch;let called=false;
 try{
  globalThis.fetch=async()=>{called=true;return new Response('{}')};
  const canonical={...env,APP_ORIGIN:'https://sales.example.com'};
  const res=await checkout({request:request('/api/checkout','http://localhost:8788',{accept_terms:true,buyer_email:'buyer@example.com'}),env:canonical});
  assert.equal(res.status,403);
  assert.equal(called,false);
 }finally{globalThis.fetch=old}
});
test('same-origin Referer is accepted when browser omits Origin',async()=>{
 const old=globalThis.fetch;
 try{
  globalThis.fetch=async()=>new Response(JSON.stringify({url:'https://checkout.stripe.com/c/pay/referer-fix'}));
  const req=new Request('http://localhost:8788/api/checkout',{method:'POST',headers:{Referer:'http://localhost:8788/pro/','Content-Type':'application/json'},body:JSON.stringify({accept_terms:true,buyer_email:'buyer@example.com'})});
  const res=await checkout({request:req,env});
  assert.equal(res.status,200);
 }finally{globalThis.fetch=old}
});
test('checkout requires a valid buyer email when Google member auth is absent',async()=>{
 const missing=await checkout({request:request('/api/checkout',undefined,{accept_terms:true}),env});assert.equal(missing.status,400);
 const invalid=await checkout({request:request('/api/checkout',undefined,{accept_terms:true,buyer_email:'not-an-email'}),env});assert.equal(invalid.status,400);
});
test('checkout forwards buyer email to Stripe Customer without storing it in metadata',async()=>{
 const old=globalThis.fetch;let seen;
 try{globalThis.fetch=async(_url,opt)=>{seen=new URLSearchParams(opt.body);return new Response(JSON.stringify({url:'https://checkout.stripe.com/c/pay/buyer-email'}))};
 const res=await checkout({request:request('/api/checkout',undefined,{accept_terms:true,buyer_email:'SECOND.BUYER@example.com'}),env});assert.equal(res.status,200);
 assert.equal(seen.get('customer_email'),'second.buyer@example.com');assert.equal(seen.get('metadata[buyer_email]'),null);
 }finally{globalThis.fetch=old}
});

test('verify unavailable without secrets',async()=>{const res=await verify({request:request('/api/entitlement'),env:{}});const body=await res.json();assert.equal(body.active,false);assert.equal(body.configured,false);assert.deepEqual(body.missing,['STRIPE_SECRET_KEY','SESSION_SECRET']);assert.deepEqual(body.issues,[{name:'STRIPE_SECRET_KEY',reason:'missing'},{name:'SESSION_SECRET',reason:'missing'}]);assert.equal(body.mode,'test')});
test('checkout uses configured Price ID only',async()=>{const old=globalThis.fetch;try{let seen=null;globalThis.fetch=async(_url,opt)=>{seen=new URLSearchParams(opt.body);return new Response(JSON.stringify({url:'https://checkout.stripe.com/c/pay/mock'}))};const res=await checkout({request:request('/api/checkout',undefined,{accept_terms:true,buyer_email:'buyer@example.com'}),env});assert.equal(res.status,200);assert.equal(seen.get('line_items[0][price]'),'price_valid');assert.equal(seen.get('mode'),'subscription');assert.equal(seen.get('wallet_options[link][display]'),'never');assert.match(seen.get('client_reference_id'),/^[A-Za-z0-9_-]{40,50}$/);assert.match(res.headers.get('Set-Cookie'),/demand_checkout=/);assert.match(seen.get('success_url'),/session_id=/)}finally{globalThis.fetch=old}});
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
 const res=await checkout({request:request('/api/checkout',undefined,{accept_terms:true,buyer_email:'buyer@example.com'}),env:simple});
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
   assert.equal(form?.get('locale'),'ja');
   assert.equal(form?.get('after_expiration[type]'),'customer_login');
 }finally{globalThis.fetch=old}
});

test('public portal email-login redirect is pinned to Stripe TEST hosted login',async()=>{
 assert.equal(portalLoginUrl({}),DEFAULT_TEST_PORTAL_LOGIN);
 const res=await portalLogin({env:{}});
 assert.equal(res.status,302);
 assert.equal(res.headers.get('Location'),DEFAULT_TEST_PORTAL_LOGIN);
 assert.equal(portalLoginUrl({STRIPE_PORTAL_LOGIN_URL:'https://evil.example/p/login/test_bad'}),null);
 const bad=await portalLogin({env:{STRIPE_PORTAL_LOGIN_URL:'https://evil.example/p/login/test_bad'}});
 assert.equal(bad.status,503);
});

test('live portal login is separate and rejects TEST login URLs',async()=>{
 const live={LIVE_BILLING_ENABLED:'true',STRIPE_LIVE_PORTAL_LOGIN_URL:'https://billing.stripe.com/p/login/live_demo123'};
 assert.equal(portalLoginUrl(live),'https://billing.stripe.com/p/login/live_demo123');
 assert.equal(portalLoginUrl({...live,STRIPE_LIVE_PORTAL_LOGIN_URL:DEFAULT_TEST_PORTAL_LOGIN}),null);
 const missing=await portalLogin({env:{LIVE_BILLING_ENABLED:'true'}});assert.equal(missing.status,503);
});


test('restricted Stripe keys are mode-scoped and LIVE Checkout fails closed without Google configuration',async()=>{
 const restricted={...env,STRIPE_SECRET_KEY:'rk_test_sample_restricted_123'};
 assert.equal(isConfigured(restricted),true);assert.equal(configurationMissing(restricted).length,0);
 const live={LIVE_BILLING_ENABLED:'true',STRIPE_LIVE_SECRET_KEY:'rk_live_sample_restricted_123',STRIPE_LIVE_PRO_PRICE_ID:'price_live123',SESSION_SECRET:'L'.repeat(48),APP_ORIGIN:'http://localhost:8788'};
 assert.equal(isConfigured(live),true);
 const old=globalThis.fetch;let seenHeader='';
 try {
   globalThis.fetch=async (_url,opts)=>{seenHeader=opts.headers.Authorization;return new Response(JSON.stringify({url:'https://checkout.stripe.com/c/pay/mock'}));};
   let res=await checkout({request:request('/api/checkout',undefined,{accept_terms:true,buyer_email:'buyer@example.com'}),env:restricted});assert.equal(res.status,200);assert.equal(seenHeader,'Bearer rk_test_sample_restricted_123');
   res=await checkout({request:request('/api/checkout',undefined,{accept_terms:true,buyer_email:'buyer@example.com'}),env:live});
   assert.equal(res.status,503);assert.equal((await res.json()).auth_not_configured,true);
 }finally{globalThis.fetch=old}
});


test('LIVE price verification fails closed when configured Price is not JPY 980',async()=>{
 const live={LIVE_BILLING_ENABLED:'true',STRIPE_LIVE_SECRET_KEY:'sk_live_mock_123',STRIPE_LIVE_PRO_PRICE_ID:'price_wrong',SESSION_SECRET:'L'.repeat(48),APP_ORIGIN:'http://localhost:8788'};
 const wrong={id:'price_wrong',livemode:true,active:true,currency:'jpy',unit_amount:1200,recurring:{interval:'month',interval_count:1},product:{active:true,metadata:{app:'demand-scope-pro',tier:'pro'}}};
 const old=globalThis.fetch;
 try{
  globalThis.fetch=async(url)=>{assert.match(String(url),/\/prices\//);return new Response(JSON.stringify(wrong))};
  const result=await verifyLivePrice(live);
  assert.equal(result.ok,false);assert.equal(result.reason,'amount');
 }finally{globalThis.fetch=old}
});
test('Stripe API errors preserve safe diagnostic fields without exposing credentials',async()=>{
 const old=globalThis.fetch;
 try{
  globalThis.fetch=async()=>new Response(JSON.stringify({error:{type:'invalid_request_error',code:'permission_missing',message:'This API key does not have permission to perform this request.',param:null}}),{status:403,headers:{'request-id':'req_test_diag_123','content-type':'application/json'}});
  const res=await checkout({request:request('/api/checkout',undefined,{accept_terms:true,buyer_email:'buyer@example.com'}),env:{STRIPE_SECRET_KEY:'rk_test_restricted_diag',SESSION_SECRET:'D'.repeat(48)}});
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
  const res=await checkout({request:request('/api/checkout',undefined,{accept_terms:true,buyer_email:'buyer@example.com'}),env:trimmed});
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
  const res=await checkout({request:request('/api/checkout',undefined,{accept_terms:true,buyer_email:'buyer@example.com'}),env});
  assert.equal(res.status,200);
  assert.equal(form.get('metadata[legal_version]'),'2026-11-10');
  assert.equal(form.get('subscription_data[metadata][legal_version]'),'2026-11-10');
  assert.match(form.get('metadata[legal_accepted_at]'),/^\d{10}$/);
 }finally{globalThis.fetch=old}
});

test('checkout completion records acceptance without downgrading subscription lifecycle status',()=>{
 const event={id:'evt_test_checkout',type:'checkout.session.completed',created:1794208204,livemode:false,data:{object:{
  id:'cs_test_linkage123',mode:'subscription',customer:'cus_test123',subscription:'sub_test123',livemode:false,
  metadata:{app:'demand-scope-pro',legal_version:'2026-11-10',legal_accepted_at:'1794208087'}
 }}};
 const acceptance=checkoutAcceptanceFromEvent(event);
 assert.equal(acceptance.customer,'cus_test123');
 assert.equal(acceptance.subscription,'sub_test123');
 assert.equal(subscriptionMutationFromEvent(event),null);
 const created={type:'customer.subscription.created',data:{object:{id:'sub_test123',customer:'cus_test123',status:'active',livemode:false,metadata:{app:'demand-scope-pro'},items:{data:[{price:{id:'price_test123'},current_period_end:1796800000}]}}}};
 assert.equal(subscriptionMutationFromEvent(created).status,'active');
});




test('Stripe-only Checkout ignores legacy AUTH_REQUIRED and still requires buyer email',async()=>{
 const stripeOnly={...env,AUTH_REQUIRED:'true'};
 const missing=await checkout({request:request('/api/checkout',undefined,{accept_terms:true}),env:stripeOnly});
 assert.equal(missing.status,400);
 const old=globalThis.fetch;let form;
 try{
  globalThis.fetch=async(_url,opt)=>{form=new URLSearchParams(opt.body);return new Response(JSON.stringify({url:'https://checkout.stripe.com/c/pay/stripe-only'}))};
  const res=await checkout({request:request('/api/checkout',undefined,{accept_terms:true,buyer_email:'buyer@example.com'}),env:stripeOnly});
  assert.equal(res.status,200);assert.equal(form.get('customer_email'),'buyer@example.com');assert.equal(form.get('metadata[member_id]'),null);
 }finally{globalThis.fetch=old}
});
