import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEMANDSCOPE_GOOGLE_CLIENT_ID,
  googleConfiguration,
  startGoogleAuthorization,
  completeGoogleCallback,
  authenticatedMember
} from '../server/google-auth.js';
import {onRequestPost as checkout} from '../functions/api/checkout.js';
import {onRequestPost as activate} from '../functions/api/activate.js';

const enc=new TextEncoder();
const b64=bytes=>Buffer.from(bytes).toString('base64url');
const json64=value=>Buffer.from(JSON.stringify(value)).toString('base64url');

function fakeDb(){
 const members=[];
 return {
  members,
  prepare(sql){
   return {
    args:[],
    bind(...args){this.args=args;return this},
    async first(){
     if(sql.includes("WHERE provider=? AND provider_subject=?"))return members.find(x=>x.provider===this.args[0]&&x.provider_subject===this.args[1])||null;
     if(sql.includes("WHERE id=? AND provider=?"))return members.find(x=>x.id===this.args[0]&&x.provider===this.args[1])||null;
     if(sql.includes("SELECT stripe_customer_id FROM members WHERE id=?"))return members.find(x=>x.id===this.args[0])||null;
     return null;
    },
    async run(){
     if(sql.startsWith('INSERT INTO members')){
      members.push({id:this.args[0],provider:this.args[1],provider_subject:this.args[2],email:this.args[3],stripe_customer_id:null});
     }else if(sql.startsWith('UPDATE members SET email=')){
      const row=members.find(x=>x.id===this.args[1]);if(row)row.email=this.args[0];
     }else if(sql.startsWith('UPDATE members SET stripe_customer_id=')){
      const row=members.find(x=>x.id===this.args[1]);if(row)row.stripe_customer_id=this.args[0];
     }
     return {success:true};
    },
    async all(){return {results:[]}}
   };
  }
 };
}

const keyPair=await crypto.subtle.generateKey(
 {name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},
 true,
 ['sign','verify']
);
const publicJwk=await crypto.subtle.exportKey('jwk',keyPair.publicKey);
publicJwk.kid='test-google-key';
publicJwk.alg='RS256';
publicJwk.use='sig';

async function signedIdToken(claims){
 const header=json64({alg:'RS256',typ:'JWT',kid:'test-google-key'});
 const payload=json64(claims);
 const input=header+'.'+payload;
 const sig=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',keyPair.privateKey,enc.encode(input));
 return input+'.'+b64(new Uint8Array(sig));
}
function env(db=fakeDb()){
 return {
  DB:db,
  GOOGLE_OAUTH_CLIENT_SECRET:'google-client-secret-test-only',
  SESSION_SECRET:'S'.repeat(48),
  STRIPE_SECRET_KEY:'sk_test_mock_google_123',
  STRIPE_PRO_PRICE_ID:'price_valid'
 };
}
function firstCookie(setCookie){return setCookie.split(';')[0]}
async function successfulIdentity({claimOverrides={}}={}){
 const db=fakeDb(),e=env(db);
 const startReq=new Request('https://web-stock-78r.pages.dev/api/auth/google/start');
 const started=await startGoogleAuthorization(startReq,e);
 const authUrl=new URL(started.url);
 const now=Math.floor(Date.now()/1000);
 const claims={
  iss:'https://accounts.google.com',
  aud:DEMANDSCOPE_GOOGLE_CLIENT_ID,
  sub:'google-subject-1234567890',
  email:'Buyer.Google@example.com',
  email_verified:true,
  exp:now+3600,
  iat:now,
  nonce:authUrl.searchParams.get('nonce'),
  ...claimOverrides
 };
 const token=await signedIdToken(claims);
 const old=globalThis.fetch;
 globalThis.fetch=async url=>{
  const s=String(url);
  if(s==='https://oauth2.googleapis.com/token')return new Response(JSON.stringify({id_token:token,access_token:'not-stored'}),{headers:{'content-type':'application/json'}});
  if(s==='https://www.googleapis.com/oauth2/v3/certs')return new Response(JSON.stringify({keys:[publicJwk]}),{headers:{'content-type':'application/json'}});
  throw new Error('unexpected fetch '+s);
 };
 try{
  const callback=new Request('https://web-stock-78r.pages.dev/api/auth/google/callback?code=one-time-code&state='+encodeURIComponent(authUrl.searchParams.get('state')),{headers:{Cookie:firstCookie(started.cookie)}});
  const result=await completeGoogleCallback(callback,e);
  return {db,e,result,started,authUrl,callback};
 }finally{globalThis.fetch=old}
}

test('DemandScope pins the intended Google OAuth client and rejects a lookalike client id',()=>{
 assert.equal(googleConfiguration({GOOGLE_OAUTH_CLIENT_SECRET:'x'.repeat(20),SESSION_SECRET:'y'.repeat(40)}).client_id,DEMANDSCOPE_GOOGLE_CLIENT_ID);
 assert.equal(googleConfiguration({GOOGLE_OAUTH_CLIENT_ID:'175542619333-tvg20hn2lobuup42ajd2p47jeck50u0c.apps.googleusercontent.com',GOOGLE_OAUTH_CLIENT_SECRET:'x'.repeat(20),SESSION_SECRET:'y'.repeat(40)}).configured,false);
});

test('Google authorization start uses exact production callback, state, nonce and PKCE',async()=>{
 const started=await startGoogleAuthorization(new Request('https://web-stock-78r.pages.dev/api/auth/google/start'),env());
 const url=new URL(started.url);
 assert.equal(url.origin,'https://accounts.google.com');
 assert.equal(url.pathname,'/o/oauth2/v2/auth');
 assert.equal(url.searchParams.get('client_id'),DEMANDSCOPE_GOOGLE_CLIENT_ID);
 assert.equal(url.searchParams.get('redirect_uri'),'https://web-stock-78r.pages.dev/api/auth/google/callback');
 assert.equal(url.searchParams.get('scope'),'openid email profile');
 assert.match(url.searchParams.get('state'),/^[A-Za-z0-9_-]{40,}$/);
 assert.match(url.searchParams.get('nonce'),/^[A-Za-z0-9_-]{40,}$/);
 assert.equal(url.searchParams.get('code_challenge_method'),'S256');
 assert.match(started.cookie,/HttpOnly/);
 assert.match(started.cookie,/SameSite=Lax/);
 assert.match(started.cookie,/Secure/);
});

test('Google callback rejects mismatched state before token exchange',async()=>{
 const e=env();
 const started=await startGoogleAuthorization(new Request('https://web-stock-78r.pages.dev/api/auth/google/start'),e);
 let called=false;const old=globalThis.fetch;globalThis.fetch=async()=>{called=true;throw new Error('must not fetch')};
 try{
  const req=new Request('https://web-stock-78r.pages.dev/api/auth/google/callback?code=abc&state=wrong',{headers:{Cookie:firstCookie(started.cookie)}});
  await assert.rejects(()=>completeGoogleCallback(req,e),/state/);
  assert.equal(called,false);
 }finally{globalThis.fetch=old}
});

test('Google callback validates signed ID token and creates an internal member keyed by sub',async()=>{
 const {db,e,result}=await successfulIdentity();
 assert.equal(db.members.length,1);
 assert.equal(db.members[0].provider,'google');
 assert.equal(db.members[0].provider_subject,'google-subject-1234567890');
 assert.equal(db.members[0].email,'buyer.google@example.com');
 assert.match(db.members[0].id,/^mem_[A-Za-z0-9_-]+$/);
 assert.match(result.cookie,/demand_identity=/);
 assert.match(result.cookie,/HttpOnly/);
 const sessionReq=new Request('https://web-stock-78r.pages.dev/api/auth/session',{headers:{Cookie:firstCookie(result.cookie)}});
 const member=await authenticatedMember(sessionReq,e);
 assert.equal(member.id,db.members[0].id);
});

for(const [label,overrides,pattern] of [
 ['issuer',{iss:'https://evil.example'},/issuer/],
 ['audience',{aud:'wrong-client.apps.googleusercontent.com'},/audience/],
 ['nonce',{nonce:'wrong-nonce'},/nonce/],
 ['expiry',{exp:1},/Expired/]
]){
 test('Google ID token rejects invalid '+label,async()=>{
  await assert.rejects(()=>successfulIdentity({claimOverrides:overrides}),pattern);
 });
}

test('Google configured checkout requires identity and binds member_id without equating Google email to billing email',async()=>{
 const {e,result,db}=await successfulIdentity();
 const noIdentity=new Request('https://web-stock-78r.pages.dev/api/checkout',{method:'POST',headers:{Origin:'https://web-stock-78r.pages.dev','Content-Type':'application/json'},body:JSON.stringify({accept_terms:true,buyer_email:'billing@example.net'})});
 const denied=await checkout({request:noIdentity,env:e});assert.equal(denied.status,401);
 const old=globalThis.fetch;let form;
 try{
  globalThis.fetch=async(_url,opt)=>{form=new URLSearchParams(opt.body);return new Response(JSON.stringify({url:'https://checkout.stripe.com/c/pay/google-member'}),{headers:{'content-type':'application/json'}})};
  const request=new Request('https://web-stock-78r.pages.dev/api/checkout',{method:'POST',headers:{Origin:'https://web-stock-78r.pages.dev','Content-Type':'application/json',Cookie:firstCookie(result.cookie)},body:JSON.stringify({accept_terms:true,buyer_email:'billing@example.net'})});
  const res=await checkout({request,env:e});assert.equal(res.status,200);
  assert.equal(form.get('customer_email'),'billing@example.net');
  assert.equal(form.get('metadata[member_id]'),db.members[0].id);
  assert.equal(form.get('subscription_data[metadata][member_id]'),db.members[0].id);
 }finally{globalThis.fetch=old}
});


test('LIVE checkout and activation succeed only with Google member binding and the initiating browser',async()=>{
 const {e,result,db}=await successfulIdentity();
 const live={
  ...e,
  LIVE_BILLING_ENABLED:'true',
  STRIPE_LIVE_SECRET_KEY:'rk_live_google_test_123',
  STRIPE_LIVE_PRO_PRICE_ID:'price_livegoogle123',
  APP_ORIGIN:'https://web-stock-78r.pages.dev'
 };
 const goodPrice={id:'price_livegoogle123',livemode:true,active:true,currency:'jpy',unit_amount:980,recurring:{interval:'month',interval_count:1},product:{active:true,metadata:{app:'demand-scope-pro',tier:'pro'}}};
 const identity=firstCookie(result.cookie);
 let checkoutForm=null;
 const old=globalThis.fetch;
 try{
  globalThis.fetch=async(url,opt={})=>{
   const s=String(url);
   if(s.includes('/prices/'))return new Response(JSON.stringify(goodPrice),{headers:{'content-type':'application/json'}});
   if(s.endsWith('/checkout/sessions')){
    checkoutForm=new URLSearchParams(opt.body);
    return new Response(JSON.stringify({url:'https://checkout.stripe.com/c/pay/live-google'}),{headers:{'content-type':'application/json'}});
   }
   if(s.includes('/checkout/sessions/cs_live_valid_member_123')){
    return new Response(JSON.stringify({
      id:'cs_live_valid_member_123',livemode:true,mode:'subscription',status:'complete',payment_status:'paid',
      client_reference_id:checkoutForm.get('client_reference_id'),
      metadata:{app:'demand-scope-pro',member_id:db.members[0].id},
      subscription:'sub_livemember123',customer:'cus_livemember123'
    }),{headers:{'content-type':'application/json'}});
   }
   if(s.includes('/subscriptions/sub_livemember123')){
    return new Response(JSON.stringify({
      id:'sub_livemember123',livemode:true,status:'active',customer:'cus_livemember123',
      metadata:{app:'demand-scope-pro',member_id:db.members[0].id},
      items:{data:[{price:{id:'price_livegoogle123'}}]}
    }),{headers:{'content-type':'application/json'}});
   }
   throw new Error('unexpected fetch '+s);
  };
  const checkoutReq=new Request('https://web-stock-78r.pages.dev/api/checkout',{
    method:'POST',
    headers:{Origin:'https://web-stock-78r.pages.dev','Content-Type':'application/json',Cookie:identity},
    body:JSON.stringify({accept_terms:true,buyer_email:'billing@example.net'})
  });
  const checkoutRes=await checkout({request:checkoutReq,env:live});
  assert.equal(checkoutRes.status,200,await checkoutRes.clone().text());
  assert.equal(checkoutForm.get('metadata[member_id]'),db.members[0].id);
  const checkoutCookie=firstCookie(checkoutRes.headers.get('Set-Cookie'));
  const activateReq=new Request('https://web-stock-78r.pages.dev/api/activate',{
    method:'POST',
    headers:{Origin:'https://web-stock-78r.pages.dev','Content-Type':'application/json',Cookie:identity+'; '+checkoutCookie},
    body:JSON.stringify({session_id:'cs_live_valid_member_123'})
  });
  const activated=await activate({request:activateReq,env:live});
  assert.equal(activated.status,200,await activated.clone().text());
  assert.match(activated.headers.get('Set-Cookie'),/demand_pro=/);
  assert.equal(db.members[0].stripe_customer_id,'cus_livemember123');
 }finally{globalThis.fetch=old}
});
