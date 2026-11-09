const enc=new TextEncoder();
const dec=new TextDecoder();
const b64url=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64url=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));
const rand=n=>b64url(crypto.getRandomValues(new Uint8Array(n)));
const secret=env=>typeof env?.SESSION_SECRET==='string'?env.SESSION_SECRET.trim():'';
async function sign(value,env){const key=await crypto.subtle.importKey('raw',enc.encode(secret(env)),{name:'HMAC',hash:'SHA-256'},false,['sign']);return b64url(new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(value))))}
function safeEqual(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0}
function secureOrigin(env,request){if(env?.APP_ORIGIN){const u=new URL(env.APP_ORIGIN);if(u.protocol!=='https:'&&u.hostname!=='localhost')throw new Error('Unsafe APP_ORIGIN');return u.origin}const u=new URL(request.url);if(u.protocol!=='https:'&&!(u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname)))throw new Error('Unsafe request origin');return u.origin}
function secureCookie(origin){return origin.startsWith('https:')?'; Secure':''}
async function signedPayload(data,env){const payload=b64url(enc.encode(JSON.stringify(data)));return payload+'.'+await sign(payload,env)}
async function readSigned(value,env){if(typeof value!=='string'||value.length>4096)return null;const [payload,sig]=value.split('.');if(!payload||!sig)return null;const target=await sign(payload,env);if(!safeEqual(sig,target))return null;try{return JSON.parse(dec.decode(unb64url(payload)))}catch{return null}}
function cookieValue(request,name){const raw=request.headers.get('Cookie')||'';const m=raw.match(new RegExp('(?:^|;\\s*)'+name+'=([^;]+)'));return m?.[1]||null}
export function authConfigured(env){return !!(env?.DB?.prepare&&typeof env?.GOOGLE_CLIENT_ID==='string'&&env.GOOGLE_CLIENT_ID.trim()&&typeof env?.GOOGLE_CLIENT_SECRET==='string'&&env.GOOGLE_CLIENT_SECRET.trim()&&secret(env).length>=32)}
export async function beginGoogleLogin(request,env){
 if(!authConfigured(env))throw new Error('Google authentication is not configured');
 const origin=secureOrigin(env,request),state=rand(24),verifier=rand(48);
 const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(verifier))),challenge=b64url(digest);
 const payload=await signedPayload({v:1,state,verifier,exp:Math.floor(Date.now()/1000)+600},env);
 const redirect=origin+'/api/auth/callback';
 const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
 url.search=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID.trim(),redirect_uri:redirect,response_type:'code',scope:'openid email profile',state,code_challenge:challenge,code_challenge_method:'S256',prompt:'select_account'}).toString();
 const cookie='demand_oauth_state='+payload+'; Path=/api/auth/; Max-Age=600; HttpOnly; SameSite=Lax'+secureCookie(origin);
 return {url:url.toString(),cookie};
}
async function readOauthState(request,env){
 const data=await readSigned(cookieValue(request,'demand_oauth_state'),env);
 if(!data||data.v!==1||typeof data.state!=='string'||typeof data.verifier!=='string'||data.exp<=Date.now()/1000)return null;
 return data;
}
async function exchangeGoogleCode(code,verifier,request,env){
 const origin=secureOrigin(env,request),redirect=origin+'/api/auth/callback';
 const res=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:env.GOOGLE_CLIENT_ID.trim(),client_secret:env.GOOGLE_CLIENT_SECRET.trim(),redirect_uri:redirect,grant_type:'authorization_code',code_verifier:verifier})});
 const token=await res.json();if(!res.ok||typeof token.id_token!=='string')throw new Error('Google token exchange failed');
 const verify=await fetch('https://oauth2.googleapis.com/tokeninfo?id_token='+encodeURIComponent(token.id_token));
 const claims=await verify.json();if(!verify.ok)throw new Error('Google ID token verification failed');
 const iss=claims.iss;if(!['accounts.google.com','https://accounts.google.com'].includes(iss)||claims.aud!==env.GOOGLE_CLIENT_ID.trim()||Number(claims.exp)<=Date.now()/1000||!claims.sub)throw new Error('Google ID token claims are invalid');
 if(claims.email&&claims.email_verified!=='true'&&claims.email_verified!==true)throw new Error('Google email is not verified');
 return {sub:String(claims.sub),email:typeof claims.email==='string'?claims.email.toLowerCase():null};
}
async function upsertMember(env,identity){
 let row=await env.DB.prepare("SELECT id,email,stripe_customer_id FROM members WHERE provider='google' AND provider_subject=?").bind(identity.sub).first();
 if(!row){const id=crypto.randomUUID();await env.DB.prepare("INSERT INTO members(id,provider,provider_subject,email) VALUES(?,?,?,?)").bind(id,'google',identity.sub,identity.email).run();row={id,email:identity.email,stripe_customer_id:null}}
 else if(identity.email&&identity.email!==row.email){await env.DB.prepare("UPDATE members SET email=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(identity.email,row.id).run();row.email=identity.email}
 return row;
}
export async function issueMemberCookie(memberId,request,env){const origin=secureOrigin(env,request);const session=await signedPayload({v:1,id:memberId,exp:Math.floor(Date.now()/1000)+7*86400},env);return 'demand_auth='+session+'; Path=/; Max-Age='+7*86400+'; HttpOnly; SameSite=Lax'+secureCookie(origin)}
export async function finishGoogleLogin(request,env){
 if(!authConfigured(env))throw new Error('Google authentication is not configured');
 const u=new URL(request.url),code=u.searchParams.get('code'),state=u.searchParams.get('state'),saved=await readOauthState(request,env);
 if(!code||!state||!saved||!safeEqual(state,saved.state))throw new Error('OAuth state validation failed');
 const identity=await exchangeGoogleCode(code,saved.verifier,request,env),member=await upsertMember(env,identity),origin=secureOrigin(env,request);
 return {member,cookie:await issueMemberCookie(member.id,request,env),clearState:'demand_oauth_state=; Path=/api/auth/; Max-Age=0; HttpOnly; SameSite=Lax'+secureCookie(origin)};
}
export async function authenticatedMember(request,env){
 if(!authConfigured(env))return null;
 const data=await readSigned(cookieValue(request,'demand_auth'),env);if(!data||data.v!==1||typeof data.id!=='string'||data.exp<=Date.now()/1000)return null;
 const row=await env.DB.prepare('SELECT id,email,stripe_customer_id FROM members WHERE id=?').bind(data.id).first();return row||null;
}
export function clearAuthCookie(request,env){const origin=secureOrigin(env,request);return 'demand_auth=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax'+secureCookie(origin)}
