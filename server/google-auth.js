import {origin,safeEqual} from './stripe.js';

const enc=new TextEncoder();
const dec=new TextDecoder();

export const DEMANDSCOPE_GOOGLE_CLIENT_ID='175542619333-3ilgeia6pa4dglofipc3f20vdqgod4ju.apps.googleusercontent.com';
const GOOGLE_AUTH_ENDPOINT='https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT='https://oauth2.googleapis.com/token';
const GOOGLE_JWKS_ENDPOINT='https://www.googleapis.com/oauth2/v3/certs';
const FLOW_COOKIE='demand_google_flow';
const IDENTITY_COOKIE='demand_identity';
const FLOW_TTL=600;
const IDENTITY_TTL=30*86400;

function normalized(value){return typeof value==='string'?value.trim():''}
function clientId(env){
 const configured=normalized(env?.GOOGLE_OAUTH_CLIENT_ID);
 if(configured&&configured!==DEMANDSCOPE_GOOGLE_CLIENT_ID)return null;
 return DEMANDSCOPE_GOOGLE_CLIENT_ID;
}
function clientSecret(env){return normalized(env?.GOOGLE_OAUTH_CLIENT_SECRET)}
function sessionSecret(env){return normalized(env?.SESSION_SECRET)}
export function googleConfiguration(env){
 const id=clientId(env),secret=clientSecret(env),session=sessionSecret(env);
 const issues=[];
 if(!id)issues.push('GOOGLE_OAUTH_CLIENT_ID_MISMATCH');
 if(secret.length<16)issues.push('GOOGLE_OAUTH_CLIENT_SECRET');
 if(session.length<32)issues.push('SESSION_SECRET');
 return {configured:issues.length===0,issues,client_id:id||DEMANDSCOPE_GOOGLE_CLIENT_ID};
}
function b64url(bytes){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function unb64url(value){
 const s=String(value||'').replace(/-/g,'+').replace(/_/g,'/');
 return Uint8Array.from(atob(s+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));
}
function randomToken(size=32){return b64url(crypto.getRandomValues(new Uint8Array(size)))}
async function hmac(value,secret){
 const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return b64url(new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(value))));
}
async function signedValue(data,secret){
 const payload=b64url(enc.encode(JSON.stringify(data)));
 return payload+'.'+await hmac(payload,secret);
}
async function verifySignedValue(value,secret){
 if(typeof value!=='string'||value.length>4096)return null;
 const dot=value.lastIndexOf('.');if(dot<1)return null;
 const payload=value.slice(0,dot),sig=value.slice(dot+1);
 const expected=await hmac(payload,secret);
 if(!safeEqual(sig,expected))return null;
 try{return JSON.parse(dec.decode(unb64url(payload)))}catch{return null}
}
function cookie(request,name){
 const source=request.headers.get('Cookie')||'';
 for(const piece of source.split(';')){
   const trimmed=piece.trim();
   const eq=trimmed.indexOf('=');
   if(eq>0&&trimmed.slice(0,eq)===name)return trimmed.slice(eq+1);
 }
 return '';
}
function secureFor(request,env){return origin(env,request).startsWith('https:')}
function cookieLine(name,value,{maxAge,path='/',secure=true}={}){
 return `${name}=${value}; Path=${path}; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure?'; Secure':''}`;
}
export function clearGoogleFlowCookie(request,env){return cookieLine(FLOW_COOKIE,'',{maxAge:0,path:'/api/auth/google',secure:secureFor(request,env)})}
export function clearIdentityCookie(request,env){return cookieLine(IDENTITY_COOKIE,'',{maxAge:0,path:'/',secure:secureFor(request,env)})}

function redirectUri(request,env){return new URL('/api/auth/google/callback',origin(env,request)).toString()}
async function pkceChallenge(verifier){
 const digest=await crypto.subtle.digest('SHA-256',enc.encode(verifier));
 return b64url(new Uint8Array(digest));
}

export async function startGoogleAuthorization(request,env){
 const cfg=googleConfiguration(env);
 if(!cfg.configured)throw new Error('Google OAuth is not configured');
 const state=randomToken(32),nonce=randomToken(32),verifier=randomToken(48);
 const flow={v:1,state,nonce,verifier,exp:Math.floor(Date.now()/1000)+FLOW_TTL};
 const signed=await signedValue(flow,sessionSecret(env));
 const url=new URL(GOOGLE_AUTH_ENDPOINT);
 url.searchParams.set('client_id',cfg.client_id);
 url.searchParams.set('redirect_uri',redirectUri(request,env));
 url.searchParams.set('response_type','code');
 url.searchParams.set('scope','openid email profile');
 url.searchParams.set('state',state);
 url.searchParams.set('nonce',nonce);
 url.searchParams.set('code_challenge',await pkceChallenge(verifier));
 url.searchParams.set('code_challenge_method','S256');
 return {url:url.toString(),cookie:cookieLine(FLOW_COOKIE,signed,{maxAge:FLOW_TTL,path:'/api/auth/google',secure:secureFor(request,env)})};
}

async function readFlow(request,env){
 const cfg=googleConfiguration(env);if(!cfg.configured)return null;
 const data=await verifySignedValue(cookie(request,FLOW_COOKIE),sessionSecret(env));
 if(!data||data.v!==1||!data.state||!data.nonce||!data.verifier||data.exp<=Date.now()/1000)return null;
 return data;
}
function parseJwtPart(part){
 try{return JSON.parse(dec.decode(unb64url(part)))}catch{return null}
}
async function verifyGoogleIdToken(idToken,{client_id,nonce}){
 if(typeof idToken!=='string'||idToken.length>12000)throw new Error('Invalid Google ID token');
 const parts=idToken.split('.');if(parts.length!==3)throw new Error('Invalid Google ID token');
 const header=parseJwtPart(parts[0]),claims=parseJwtPart(parts[1]);
 if(!header||!claims||header.alg!=='RS256'||typeof header.kid!=='string'||header.kid.length>200)throw new Error('Invalid Google ID token header');
 const jwksResponse=await fetch(GOOGLE_JWKS_ENDPOINT,{headers:{Accept:'application/json'}});
 if(!jwksResponse.ok)throw new Error('Google signing keys unavailable');
 const jwks=await jwksResponse.json();
 const jwk=(jwks?.keys||[]).find(k=>k?.kid===header.kid&&k?.kty==='RSA');
 if(!jwk)throw new Error('Google signing key not found');
 const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
 const valid=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,unb64url(parts[2]),enc.encode(parts[0]+'.'+parts[1]));
 if(!valid)throw new Error('Invalid Google ID token signature');
 const now=Math.floor(Date.now()/1000);
 if(!['https://accounts.google.com','accounts.google.com'].includes(claims.iss))throw new Error('Invalid Google issuer');
 const audiences=Array.isArray(claims.aud)?claims.aud:[claims.aud];
 if(!audiences.includes(client_id))throw new Error('Invalid Google audience');
 if(claims.azp&&claims.azp!==client_id)throw new Error('Invalid Google authorized presenter');
 if(!Number.isInteger(claims.exp)||claims.exp<=now-30)throw new Error('Expired Google ID token');
 if(Number.isInteger(claims.iat)&&claims.iat>now+120)throw new Error('Invalid Google issued-at time');
 if(claims.nonce!==nonce)throw new Error('Invalid Google nonce');
 if(typeof claims.sub!=='string'||claims.sub.length<3||claims.sub.length>255)throw new Error('Invalid Google subject');
 if(claims.email_verified!==true)throw new Error('Google email is not verified');
 const email=typeof claims.email==='string'?claims.email.trim().toLowerCase():'';
 if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Invalid Google email');
 return {sub:claims.sub,email,email_verified:true};
}

async function exchangeCode(request,env,code,flow){
 const cfg=googleConfiguration(env);
 const body=new URLSearchParams({
   code,
   client_id:cfg.client_id,
   client_secret:clientSecret(env),
   redirect_uri:redirectUri(request,env),
   grant_type:'authorization_code',
   code_verifier:flow.verifier
 });
 const res=await fetch(GOOGLE_TOKEN_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'},body});
 let data={};try{data=await res.json()}catch{}
 if(!res.ok||typeof data.id_token!=='string')throw new Error('Google token exchange failed');
 return verifyGoogleIdToken(data.id_token,{client_id:cfg.client_id,nonce:flow.nonce});
}

async function dbFirst(statement){return statement?.first?statement.first():null}
export async function ensureGoogleMember(env,identity){
 if(!env?.DB?.prepare)throw new Error('D1 DB binding is required for Google login');
 let member=await dbFirst(env.DB.prepare('SELECT id,provider,provider_subject,email,stripe_customer_id FROM members WHERE provider=? AND provider_subject=?').bind('google',identity.sub));
 if(member){
   if(member.email!==identity.email){
     await env.DB.prepare('UPDATE members SET email=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(identity.email,member.id).run();
     member={...member,email:identity.email};
   }
   return member;
 }
 const id='mem_'+randomToken(18);
 await env.DB.prepare('INSERT INTO members(id,provider,provider_subject,email) VALUES(?,?,?,?)').bind(id,'google',identity.sub,identity.email).run();
 return {id,provider:'google',provider_subject:identity.sub,email:identity.email,stripe_customer_id:null};
}
async function identityCookie(member,env,secure){
 const payload={v:1,member_id:member.id,provider:'google',exp:Math.floor(Date.now()/1000)+IDENTITY_TTL};
 return cookieLine(IDENTITY_COOKIE,await signedValue(payload,sessionSecret(env)),{maxAge:IDENTITY_TTL,path:'/',secure});
}
export async function authenticatedMember(request,env){
 if(!env?.DB?.prepare||sessionSecret(env).length<32)return null;
 const data=await verifySignedValue(cookie(request,IDENTITY_COOKIE),sessionSecret(env));
 if(!data||data.v!==1||data.provider!=='google'||typeof data.member_id!=='string'||data.exp<=Date.now()/1000)return null;
 return dbFirst(env.DB.prepare('SELECT id,provider,provider_subject,email,stripe_customer_id FROM members WHERE id=? AND provider=?').bind(data.member_id,'google'));
}
export async function completeGoogleCallback(request,env){
 const cfg=googleConfiguration(env);if(!cfg.configured)throw new Error('Google OAuth is not configured');
 const url=new URL(request.url),state=url.searchParams.get('state')||'',code=url.searchParams.get('code')||'';
 const flow=await readFlow(request,env);
 if(!flow||!state||!code||state!==flow.state)throw new Error('Invalid Google OAuth state');
 if(code.length>2048)throw new Error('Invalid Google authorization code');
 const identity=await exchangeCode(request,env,code,flow);
 const member=await ensureGoogleMember(env,identity);
 return {member,cookie:await identityCookie(member,env,secureFor(request,env))};
}
export async function linkMemberStripeCustomer(env,memberId,customerId){
 if(!env?.DB?.prepare||!/^mem_[A-Za-z0-9_-]{12,64}$/.test(memberId)||!/^cus_[A-Za-z0-9]+$/.test(customerId))throw new Error('Invalid member/customer link');
 const existing=await dbFirst(env.DB.prepare('SELECT stripe_customer_id FROM members WHERE id=?').bind(memberId));
 if(!existing)throw new Error('Member not found');
 if(existing.stripe_customer_id&&existing.stripe_customer_id!==customerId)throw new Error('Member is already linked to another Stripe customer');
 await env.DB.prepare('UPDATE members SET stripe_customer_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(customerId,memberId).run();
 return true;
}
export async function googleAuthStatus(request,env){
 const cfg=googleConfiguration(env);
 const member=cfg.configured?await authenticatedMember(request,env):null;
 return {configured:cfg.configured,issues:cfg.issues,authenticated:!!member,member:member?{id:member.id,email:member.email,provider:'google'}:null,client_id_suffix:'...3ilgeia6pa4dglofipc3f20vdqgod4ju.apps.googleusercontent.com'};
}
