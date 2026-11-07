const enc=new TextEncoder();
export function json(body,status=200,headers={}) {const h=new Headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});if(headers instanceof Headers){headers.forEach((value,key)=>h.append(key,value));}else for(const [key,value] of Object.entries(headers))h.append(key,value);return new Response(JSON.stringify(body),{status,headers:h})}
export function isConfigured(env) {return typeof env.STRIPE_SECRET_KEY==='string'&&env.STRIPE_SECRET_KEY.startsWith('sk_test_')&&typeof env.STRIPE_PRO_PRICE_ID==='string'&&env.STRIPE_PRO_PRICE_ID.startsWith('price_')&&typeof env.SESSION_SECRET==='string'&&env.SESSION_SECRET.length>=32&&typeof env.APP_ORIGIN==='string'&&/^https?:\/\//.test(env.APP_ORIGIN)}
export function origin(env){return new URL(env.APP_ORIGIN).origin}
export function validOrigin(request,env){const h=request.headers.get('Origin');return h===origin(env)}
export async function stripe(env,path,form){if(!isConfigured(env))throw new Error('Stripe test configuration is not complete');const opts={method:form?'POST':'GET',headers:{'Authorization':`Bearer ${env.STRIPE_SECRET_KEY}`,'Stripe-Version':'2025-09-30.clover'}};if(form){opts.headers['Content-Type']='application/x-www-form-urlencoded';opts.body=new URLSearchParams(form)}const res=await fetch(`https://api.stripe.com/v1${path}`,opts);const data=await res.json();if(!res.ok)throw new Error(data.error?.message||'Stripe API error');return data}
const b64url=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64url=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));
async function signature(content,secret){const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return b64url(new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(content))))}
export function safeEqual(a,b){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0}
// Bind the browser that starts Checkout to the subsequent activation.
// Session IDs returned in URLs are NOT login credentials by themselves.
export async function checkoutBrowserState(env, secure=true){
 const bytes=crypto.getRandomValues(new Uint8Array(32));
 const token=b64url(bytes);
 const reference=await signature(`checkout:${token}`,env.SESSION_SECRET);
 const cookie=`demand_checkout=${token}; Path=/; Max-Age=7200; HttpOnly; SameSite=Lax${secure?'; Secure':''}`;
 return {reference,cookie};
}
export async function validCheckoutBrowser(request,env,session){
 const raw=request.headers.get('Cookie')?.match(/(?:^|;\s*)demand_checkout=([A-Za-z0-9_-]{40,60})/)?.[1];
 if(!raw||typeof session?.client_reference_id!=='string')return false;
 const reference=await signature(`checkout:${raw}`,env.SESSION_SECRET);
 return safeEqual(reference,session.client_reference_id);
}
export async function issueCookie(subscription,customer,env,secure=true){const payload=b64url(enc.encode(JSON.stringify({v:1,sub:subscription,customer,exp:Math.floor(Date.now()/1000)+14*86400})));const sig=await signature(payload,env.SESSION_SECRET);return `demand_pro=${payload}.${sig}; Path=/; Max-Age=${14*86400}; HttpOnly; SameSite=Lax${secure?'; Secure':''}`}
export function clearCookie(secure=true){return `demand_pro=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure?'; Secure':''}`}
async function readCookie(request,env){const m=request.headers.get('Cookie')?.match(/(?:^|;\s*)demand_pro=([^;]+)/);if(!m)return null;const [payload,sig]=m[1].split('.');if(!payload||!sig||payload.length>1024)return null;const target=await signature(payload,env.SESSION_SECRET);if(!safeEqual(target,sig))return null;try{const data=JSON.parse(new TextDecoder().decode(unb64url(payload)));if(data.v!==1||data.exp<=Date.now()/1000||!/^sub_[A-Za-z0-9]+$/.test(data.sub)||!/^cus_[A-Za-z0-9]+$/.test(data.customer))return null;return data}catch{return null}}
export async function verifiedSubscription(env,id,customer=null){if(!/^sub_[A-Za-z0-9]+$/.test(id))return null;const data=await stripe(env,`/subscriptions/${encodeURIComponent(id)}`);if(data.livemode!==false||!['active','trialing'].includes(data.status)||!(data.items?.data||[]).some(item=>item.price?.id===env.STRIPE_PRO_PRICE_ID))return null;if(customer&&data.customer!==customer)return null;return data}
export async function entitlement(request,env){if(!isConfigured(env))return null;const auth=await readCookie(request,env);if(!auth)return null;const sub=await verifiedSubscription(env,auth.sub,auth.customer);return sub?{customer:auth.customer,subscription:auth.sub,status:sub.status}:null}
export async function verifyWebhook(payload,header,secret){if(!secret?.startsWith('whsec_')||!header)return false;const fields=Object.fromEntries(header.split(',').map(s=>s.split('=')));const ts=Number(fields.t);if(!Number.isInteger(ts)||Math.abs(Date.now()/1000-ts)>300)return false;const mac=await signature(`${ts}.${payload}`,secret);const hex=Array.from(unb64url(mac)).map(n=>n.toString(16).padStart(2,'0')).join('');return header.split(',').some(piece=>piece.startsWith('v1=')&&safeEqual(piece.slice(3),hex))}
