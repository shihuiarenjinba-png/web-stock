const enc=new TextEncoder();
export function json(body,status=200,headers={}) {const h=new Headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});if(headers instanceof Headers){headers.forEach((value,key)=>h.append(key,value));}else for(const [key,value] of Object.entries(headers))h.append(key,value);return new Response(JSON.stringify(body),{status,headers:h})}

// Billing defaults to TEST. Live billing is enabled only when LIVE_BILLING_ENABLED=true
// AND a dedicated live Stripe key + live recurring Price ID are configured.
export const TEST_MONTHLY_JPY=100;
export const LIVE_INVENTORY_MONTHLY_JPY=980;
export const LIVE_MARKDOWN_MONTHLY_JPY=980;
export const LIVE_MARKDOWN10_MONTHLY_JPY=1580;
export const LIVE_BUNDLE_MONTHLY_JPY=1800;
export const LIVE_INVENTORY_PRICE_ID='price_1Ua2NWBGa8rL8jwIKk7Tbtas';
export const LIVE_MARKDOWN_PRICE_ID='price_1UcK5FBGa8rL8jwIHXsLDQJE';
export const LIVE_MARKDOWN10_PRICE_ID='price_1UeVFEBGa8rL8jwIMkOc1Q7U';
export const LIVE_BUNDLE_PRICE_ID='price_1UcK5GBGa8rL8jwIwinMXtj8';
export const LIVE_MONTHLY_JPY=LIVE_INVENTORY_MONTHLY_JPY;
export const LIVE_PRO_PRICE_ID=LIVE_BUNDLE_PRICE_ID;
export const LIVE_APP_ORIGIN='https://web-stock-78r.pages.dev';
export const LIVE_PORTAL_CONFIG_ID='bpc_1UZqUZBGa8rL8jwIrmBsxuO0';
export const LIVE_PORTAL_LOGIN_URL='https://billing.stripe.com/p/login/7sYaEW1Q36DN9Km1GN93y00';
export const OWNER_LIVE_SALE_APPROVED=true;
function normalizedSecret(value){return typeof value==='string'?value.trim():''}
function normalizedValue(value){return typeof value==='string'?value.trim():''}
function configuredOrigin(env){
 const raw=normalizedValue(env?.APP_ORIGIN)||(billingMode(env)==='live'?LIVE_APP_ORIGIN:'');
 if(!raw)return null;
 try{
  const u=new URL(raw);
  const local=u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname);
  if(!(u.protocol==='https:'||local)||u.username||u.password||u.origin!==raw)return null;
  return u.origin;
 }catch{return null}
}
export function billingMode(env){
 const explicit=normalizedValue(env?.LIVE_BILLING_ENABLED);
 if(explicit==='false')return 'test';
 if(explicit==='true')return 'live';
 const liveKey=normalizedSecret(env?.STRIPE_LIVE_SECRET_KEY);
 return OWNER_LIVE_SALE_APPROVED&&(/^(?:sk|rk)_live_/.test(liveKey))?'live':'test';
}
export function expectedLivemode(env){return billingMode(env)==='live'}
export function activeStripeKey(env){
 return billingMode(env)==='live'
  ?normalizedSecret(env?.STRIPE_LIVE_SECRET_KEY)
  :normalizedSecret(env?.STRIPE_TEST_SECRET_KEY||env?.STRIPE_SECRET_KEY);
}
export const DEMANDSCOPE_PLANS={
 inventory:{key:'inventory',priceId:LIVE_INVENTORY_PRICE_ID,amount:LIVE_INVENTORY_MONTHLY_JPY,capabilities:['inventory']},
 markdown:{key:'markdown',priceId:LIVE_MARKDOWN_PRICE_ID,amount:LIVE_MARKDOWN_MONTHLY_JPY,capabilities:['markdown']},
 markdown10:{key:'markdown10',priceId:LIVE_MARKDOWN10_PRICE_ID,amount:LIVE_MARKDOWN10_MONTHLY_JPY,capabilities:['markdown','markdown10']},
 bundle:{key:'bundle',priceId:LIVE_BUNDLE_PRICE_ID,amount:LIVE_BUNDLE_MONTHLY_JPY,capabilities:['inventory','markdown']}
};
export function planDefinition(plan='bundle'){
 return DEMANDSCOPE_PLANS[String(plan||'').toLowerCase()]||null;
}
export function activePriceId(env,plan='bundle'){
 if(billingMode(env)==='live'){
  if(plan==='inventory')return normalizedValue(env?.STRIPE_LIVE_INVENTORY_PRICE_ID||env?.STRIPE_LIVE_PRO_PRICE_ID)||LIVE_INVENTORY_PRICE_ID;
  if(plan==='markdown')return normalizedValue(env?.STRIPE_LIVE_MARKDOWN_PRICE_ID)||LIVE_MARKDOWN_PRICE_ID;
  if(plan==='markdown10')return normalizedValue(env?.STRIPE_LIVE_MARKDOWN10_PRICE_ID)||LIVE_MARKDOWN10_PRICE_ID;
  return normalizedValue(env?.STRIPE_LIVE_BUNDLE_PRICE_ID)||LIVE_BUNDLE_PRICE_ID;
 }
 return normalizedValue(env?.STRIPE_PRO_PRICE_ID);
}
export function activeLivePriceIds(env){
 return ['inventory','markdown','markdown10','bundle'].map(plan=>activePriceId(env,plan)).filter(Boolean);
}
export function capabilitiesForPriceId(env,priceId){
 if(billingMode(env)!=='live')return ['inventory','markdown'];
 for(const plan of ['inventory','markdown','markdown10','bundle']){
  if(activePriceId(env,plan)===priceId)return planDefinition(plan).capabilities;
 }
 return [];
}
export function planForPriceId(env,priceId){
 if(billingMode(env)!=='live')return 'bundle';
 for(const plan of ['inventory','markdown','markdown10','bundle'])if(activePriceId(env,plan)===priceId)return plan;
 return null;
}
export function configurationDiagnostics(env){
 const issues=[],mode=billingMode(env),keyName=mode==='live'?'STRIPE_LIVE_SECRET_KEY':'STRIPE_SECRET_KEY';
 const stripeKey=activeStripeKey(env);
 if(stripeKey.length===0)issues.push({name:keyName,reason:'missing'});
 else if(stripeKey.includes('STRIPE_SECRET_KEY=')||stripeKey.includes('STRIPE_LIVE_SECRET_KEY=')||stripeKey.includes('STRIPE_TEST_SECRET_KEY='))issues.push({name:keyName,reason:'pasted_assignment'});
 else if(mode==='live'&&!(stripeKey.startsWith('sk_live_')||stripeKey.startsWith('rk_live_')))issues.push({name:keyName,reason:'live_key_format'});
 else if(mode==='test'&&!(stripeKey.startsWith('sk_test_')||stripeKey.startsWith('rk_test_')))issues.push({name:keyName,reason:'test_key_format'});
 const sessionSecret=normalizedSecret(env?.SESSION_SECRET);
 if(sessionSecret.length===0)issues.push({name:'SESSION_SECRET',reason:'missing'});
 else if(sessionSecret.length<32)issues.push({name:'SESSION_SECRET',reason:'too_short'});
 const priceIds=mode==='live'?activeLivePriceIds(env):[activePriceId(env)].filter(Boolean);
 if(mode==='live'&&priceIds.length!==4)issues.push({name:'STRIPE_LIVE_PLAN_PRICE_IDS',reason:'missing'});
 for(const priceId of priceIds)if(!/^price_[A-Za-z0-9]+$/.test(priceId))issues.push({name:mode==='live'?'STRIPE_LIVE_PLAN_PRICE_IDS':'STRIPE_PRO_PRICE_ID',reason:'invalid_format'});
 const appOrigin=normalizedValue(env?.APP_ORIGIN)||(mode==='live'?LIVE_APP_ORIGIN:'');
 if(mode==='live'&&!appOrigin)issues.push({name:'APP_ORIGIN',reason:'missing'});
 else if(appOrigin&&!configuredOrigin(env))issues.push({name:'APP_ORIGIN',reason:'invalid_origin'});
 return issues;
}
export function configurationMissing(env){return [...new Set(configurationDiagnostics(env).map(x=>x.name))]}
export function isConfigured(env){return configurationMissing(env).length===0}
export function validateLivePriceObject(price,{expectedAmount=LIVE_INVENTORY_MONTHLY_JPY,expectedCapability=null}={}){
 const product=price?.product;
 if(price?.livemode!==true)return {ok:false,reason:'not_live'};
 if(price?.active!==true)return {ok:false,reason:'inactive'};
 if(price?.currency!=='jpy')return {ok:false,reason:'currency'};
 if(expectedAmount!==null&&price?.unit_amount!==expectedAmount)return {ok:false,reason:'amount'};
 if(price?.recurring?.interval!=='month'||Number(price?.recurring?.interval_count||1)!==1)return {ok:false,reason:'interval'};
 if(!product||typeof product!=='object')return {ok:false,reason:'product_not_expanded'};
 if(product.active!==true)return {ok:false,reason:'product_inactive'};
 if(product.metadata?.app!=='demand-scope-pro')return {ok:false,reason:'product_metadata'};
 if(expectedCapability&&price.metadata?.capability&&price.metadata.capability!==expectedCapability)return {ok:false,reason:'price_metadata'};
 return {ok:true,reason:null,price};
}
export async function verifyLivePrice(env,plan='bundle'){
 if(billingMode(env)!=='live')return {ok:false,reason:'not_live_mode'};
 const def=planDefinition(plan);if(!def)return {ok:false,reason:'invalid_plan'};
 const priceId=activePriceId(env,plan);
 if(!priceId)return {ok:false,reason:'missing'};
 const price=await stripe(env,`/prices/${encodeURIComponent(priceId)}?expand[]=product`);
 return validateLivePriceObject(price,{expectedAmount:def.amount,expectedCapability:plan});
}
export async function verifyAllLivePrices(env){
 const results={};
 for(const plan of ['inventory','markdown','markdown10','bundle'])results[plan]=await verifyLivePrice(env,plan);
 return {ok:Object.values(results).every(x=>x.ok),results};
}
export function isPublicProductionRequest(request){
 try{return new URL(request.url).origin===LIVE_APP_ORIGIN}catch{return false}
}
function trustedRequestOrigin(request){
 if(!request)throw new Error('Request required');
 const value=new URL(request.url);
 if(value.protocol!=='https:' && !(value.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(value.hostname)))throw new Error('Untrusted URL');
 return value.origin;
}
export function origin(env,request){
 const configured=configuredOrigin(env);
 if(configured)return configured;
 if(request)return trustedRequestOrigin(request);
 throw new Error('Request required when APP_ORIGIN is not configured');
}
export function validOrigin(request,env){
 try{
  const requestOrigin=trustedRequestOrigin(request);
  const target=configuredOrigin(env)||requestOrigin;
  if(requestOrigin!==target)return false;
  const h=request.headers.get('Origin');
  if(h)return new URL(h).origin===target;
  const ref=request.headers.get('Referer');
  return !!ref&&new URL(ref).origin===target;
 }catch{return false}
}
export class StripeApiError extends Error {
 constructor(message,{status=502,type=null,code=null,requestId=null,param=null}={}){super(message);this.name='StripeApiError';this.status=status;this.type=type;this.code=code;this.requestId=requestId;this.param=param}
}
export async function stripe(env,path,form){
 if(!isConfigured(env))throw new Error('Stripe billing configuration is not complete');
 const opts={method:form?'POST':'GET',headers:{'Authorization':`Bearer ${activeStripeKey(env)}`,'Stripe-Version':'2025-09-30.clover'}};
 if(form){opts.headers['Content-Type']='application/x-www-form-urlencoded';opts.body=new URLSearchParams(form)}
 const res=await fetch(`https://api.stripe.com/v1${path}`,opts);
 let data={};try{data=await res.json()}catch{}
 if(!res.ok){
  const e=data.error||{};
  throw new StripeApiError(e.message||'Stripe API error',{status:res.status,type:e.type||null,code:e.code||null,requestId:res.headers.get('request-id')||res.headers.get('Request-Id')||null,param:e.param||null});
 }
 return data
}
const b64url=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64url=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));
async function signature(content,secret){const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return b64url(new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(content))))}
export function safeEqual(a,b){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0}
export async function checkoutBrowserState(env,secure=true){
 const bytes=crypto.getRandomValues(new Uint8Array(32));
 const token=b64url(bytes);
 const reference=await signature(`checkout:${token}`,normalizedSecret(env.SESSION_SECRET));
 const cookie=`demand_checkout=${token}; Path=/; Max-Age=7200; HttpOnly; SameSite=Lax${secure?'; Secure':''}`;
 return {reference,cookie};
}
export async function validCheckoutBrowser(request,env,session){
 const raw=request.headers.get('Cookie')?.match(/(?:^|;\s*)demand_checkout=([A-Za-z0-9_-]{40,60})/)?.[1];
 if(!raw||typeof session?.client_reference_id!=='string')return false;
 const reference=await signature(`checkout:${raw}`,normalizedSecret(env.SESSION_SECRET));
 return safeEqual(reference,session.client_reference_id);
}
export async function issueCookie(subscription,customer,env,secure=true){const payload=b64url(enc.encode(JSON.stringify({v:1,sub:subscription,customer,live:expectedLivemode(env),exp:Math.floor(Date.now()/1000)+14*86400})));const sig=await signature(payload,normalizedSecret(env.SESSION_SECRET));return `demand_pro=${payload}.${sig}; Path=/; Max-Age=${14*86400}; HttpOnly; SameSite=Lax${secure?'; Secure':''}`}
export function clearCookie(secure=true){return `demand_pro=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure?'; Secure':''}`}
async function readCookie(request,env){
 const m=request.headers.get('Cookie')?.match(/(?:^|;\s*)demand_pro=([^;]+)/);if(!m)return null;
 const [payload,sig]=m[1].split('.');if(!payload||!sig||payload.length>1024)return null;
 const target=await signature(payload,normalizedSecret(env.SESSION_SECRET));if(!safeEqual(target,sig))return null;
 try{const data=JSON.parse(new TextDecoder().decode(unb64url(payload)));if(data.v!==1||data.exp<=Date.now()/1000||data.live!==expectedLivemode(env)||!/^sub_[A-Za-z0-9]+$/.test(data.sub)||!/^cus_[A-Za-z0-9]+$/.test(data.customer))return null;return data}catch{return null}
}
export async function verifiedSubscription(env,id,customer=null){
 if(!/^sub_[A-Za-z0-9]+$/.test(id))return null;
 const data=await stripe(env,`/subscriptions/${encodeURIComponent(id)}`);
 if(data.livemode!==expectedLivemode(env)||!['active','trialing'].includes(data.status)||data.metadata?.app!=='demand-scope-pro')return null;
 if(customer&&data.customer!==customer)return null;
 let matchedPrice=null;
 for(const item of data.items?.data||[]){
  const price=item.price||{};
  if(billingMode(env)==='live'&&activeLivePriceIds(env).includes(price.id)){matchedPrice=price;break}
  if(billingMode(env)==='test'&&((activePriceId(env)&&price.id===activePriceId(env))||(!activePriceId(env)&&price.currency==='jpy'&&price.unit_amount===TEST_MONTHLY_JPY&&price.recurring?.interval==='month'))){matchedPrice=price;break}
 }
 if(!matchedPrice)return null;
 data.demandScopePlan=planForPriceId(env,matchedPrice.id)||'bundle';
 data.demandScopeCapabilities=capabilitiesForPriceId(env,matchedPrice.id);
 return data;
}
export async function entitlement(request,env){if(!isConfigured(env))return null;const auth=await readCookie(request,env);if(!auth)return null;const sub=await verifiedSubscription(env,auth.sub,auth.customer);return sub?{customer:auth.customer,subscription:auth.sub,status:sub.status,plan:sub.demandScopePlan,capabilities:sub.demandScopeCapabilities}:null}
export async function verifyWebhook(payload,header,secret){if(!secret?.startsWith('whsec_')||!header)return false;const fields=Object.fromEntries(header.split(',').map(s=>s.split('=')));const ts=Number(fields.t);if(!Number.isInteger(ts)||Math.abs(Date.now()/1000-ts)>300)return false;const mac=await signature(`${ts}.${payload}`,secret);const hex=Array.from(unb64url(mac)).map(n=>n.toString(16).padStart(2,'0')).join('');return header.split(',').some(piece=>piece.startsWith('v1=')&&safeEqual(piece.slice(3),hex))}
