const enc=new TextEncoder();
const hex=bytes=>Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('');
const b64url=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');

function normalized(value){return typeof value==='string'?value.trim():''}
function safeBaseUrl(value){
 try{
  const u=new URL(value);
  const local=['localhost','127.0.0.1','[::1]'].includes(u.hostname);
  if(u.protocol!=='https:'&&!(u.protocol==='http:'&&local))return null;
  if(u.username||u.password||u.search||u.hash||u.pathname!=='/')return null;
  return u.origin;
 }catch{return null}
}
async function hmacHex(secret,value){
 const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return hex(new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(value))));
}
function randomNonce(){return b64url(crypto.getRandomValues(new Uint8Array(24)))}

export function authMailGatewayConfig(env){
 const url=safeBaseUrl(normalized(env?.AUTH_MAIL_GATEWAY_URL));
 const appId=normalized(env?.AUTH_MAIL_APP_ID);
 const secret=normalized(env?.AUTH_MAIL_APP_SECRET);
 const appOk=/^[a-z0-9][a-z0-9_-]{1,63}$/.test(appId);
 return {configured:!!url&&appOk&&secret.length>=32,url,app_id:appOk?appId:null,secret_configured:secret.length>=32};
}

export async function signedGatewayRequest(env,path,body){
 const cfg=authMailGatewayConfig(env);if(!cfg.configured)throw new Error('Auth Mail Gateway is not configured');
 const raw=JSON.stringify(body??{}),timestamp=String(Math.floor(Date.now()/1000)),nonce=randomNonce();
 const secret=normalized(env.AUTH_MAIL_APP_SECRET);
 const signature=await hmacHex(secret,`${timestamp}.${nonce}.${raw}`);
 return {
  url:cfg.url+path,
  options:{method:'POST',headers:{
   'Content-Type':'application/json',
   'x-auth-mail-app':cfg.app_id,
   'x-auth-mail-timestamp':timestamp,
   'x-auth-mail-nonce':nonce,
   'x-auth-mail-signature':signature
  },body:raw}
 };
}

async function gatewayPost(env,path,body){
 const req=await signedGatewayRequest(env,path,body);
 const res=await fetch(req.url,req.options);
 let data={};try{data=await res.json()}catch{}
 if(!res.ok)throw new Error(`Auth Mail Gateway error: ${data?.error||res.status}`);
 return data;
}

export async function requestGatewayMagicLink(env,email){
 return gatewayPost(env,'/v1/magic-link/request',{email});
}

export async function consumeGatewayAssertion(env,code){
 return gatewayPost(env,'/v1/assertion/consume',{code});
}

export async function gatewayHealth(env){
 const cfg=authMailGatewayConfig(env);if(!cfg.configured)return {reachable:false,ready:false,configured:false};
 try{
  const res=await fetch(cfg.url+'/health',{headers:{Accept:'application/json'}});
  let data={};try{data=await res.json()}catch{}
  if(!res.ok||data?.service!=='auth-mail-gateway')return {reachable:false,ready:false,configured:true};
  return {reachable:true,ready:data.ready===true,configured:true,sender_domain:data.sender_domain||null,email_provider:data.email_provider||null,configured_apps:Number(data.configured_apps||0)};
 }catch{return {reachable:false,ready:false,configured:true}}
}
