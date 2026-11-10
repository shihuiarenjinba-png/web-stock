import {stripe,verifiedSubscription,origin} from './stripe.js';

const enc=new TextEncoder();
const hex=bytes=>Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('');
const b64url=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');

export function normalizeEmail(value){
 const email=String(value||'').trim().toLowerCase();
 return email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?email:null;
}
export async function sha256(value){
 return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(value))));
}
export function magicLinkConfig(env){
 const from=normalizeEmail(env?.MAGIC_LINK_FROM);
 const account=String(env?.CLOUDFLARE_EMAIL_ACCOUNT_ID||'').trim();
 const token=String(env?.CLOUDFLARE_EMAIL_API_TOKEN||'').trim();
 const enabled=env?.MAGIC_LINK_ENABLED==='true';
 const fromHost=from?.split('@')[1]||'';
 const safeSender=!!from&&!/\.(?:pages|workers)\.dev$/i.test(fromHost)&&!/(?:^|\.)pages\.dev$/i.test(fromHost)&&!/(?:^|\.)workers\.dev$/i.test(fromHost);
 return {
  enabled,
  configured:enabled&&!!env?.DB?.prepare&&safeSender&&/^[a-f0-9]{32}$/i.test(account)&&token.length>=20,
  sender:from,
  sender_domain:safeSender?fromHost:null,
  account_configured:/^[a-f0-9]{32}$/i.test(account),
  token_configured:token.length>=20,
  db_configured:!!env?.DB?.prepare
 };
}
export async function findActiveDemandScopeSubscription(env,email){
 const normalized=normalizeEmail(email);if(!normalized)return null;
 const customers=await stripe(env,`/customers?email=${encodeURIComponent(normalized)}&limit=10`);
 for(const customer of customers?.data||[]){
  if(!/^cus_[A-Za-z0-9]+$/.test(customer?.id))continue;
  const subs=await stripe(env,`/subscriptions?customer=${encodeURIComponent(customer.id)}&status=all&limit=20`);
  for(const candidate of subs?.data||[]){
   if(!['active','trialing'].includes(candidate?.status)||candidate?.metadata?.app!=='demand-scope-pro')continue;
   const verified=await verifiedSubscription(env,candidate.id,customer.id);
   if(verified)return {customer:customer.id,subscription:candidate.id,status:verified.status};
  }
 }
 return null;
}
export async function sendMagicLinkEmail(env,{to,url}){
 const cfg=magicLinkConfig(env);if(!cfg.configured)throw new Error('Magic link email is not configured');
 const payload={
  from:cfg.sender,
  to,
  subject:'DemandScope Pro ログインリンク',
  text:`DemandScope Pro の本人確認リンクです。10分以内に開いてください。\n\n${url}\n\nこの操作に心当たりがない場合は、このメールを無視してください。`,
  html:`<p>DemandScope Pro の本人確認リンクです。</p><p><a href="${url}">DemandScope Proをこのブラウザで開く</a></p><p>このリンクは10分間・1回限り有効です。</p><p>この操作に心当たりがない場合は、このメールを無視してください。</p>`
 };
 const res=await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_EMAIL_ACCOUNT_ID}/email/sending/send`,{
  method:'POST',headers:{Authorization:`Bearer ${String(env.CLOUDFLARE_EMAIL_API_TOKEN).trim()}`,'Content-Type':'application/json'},body:JSON.stringify(payload)
 });
 let data={};try{data=await res.json()}catch{}
 if(!res.ok||data?.success===false)throw new Error('Cloudflare Email Service send failed');
 return {messageId:data?.result?.message_id||data?.result?.id||null};
}
export async function createMagicLink(env,email,request){
 const cfg=magicLinkConfig(env);if(!cfg.configured)return {sent:false,reason:'not_configured'};
 const normalized=normalizeEmail(email);if(!normalized)return {sent:false,reason:'invalid_email'};
 const now=Math.floor(Date.now()/1000),emailHash=await sha256(normalized);
 await env.DB.prepare('DELETE FROM magic_link_tokens WHERE expires_at <= ?').bind(now).run();
 const recent=await env.DB.prepare("SELECT COUNT(*) AS n FROM magic_link_tokens WHERE email_hash=? AND created_at >= datetime('now','-15 minutes')").bind(emailHash).first();
 if(Number(recent?.n||0)>=3)return {sent:false,reason:'rate_limited'};
 let access;try{access=await findActiveDemandScopeSubscription(env,normalized)}catch{return {sent:false,reason:'stripe_unavailable'}}
 if(!access)return {sent:false,reason:'no_active_subscription'};
 const raw=b64url(crypto.getRandomValues(new Uint8Array(32))),tokenHash=await sha256(raw),expires=now+600;
 await env.DB.prepare('INSERT INTO magic_link_tokens(token_hash,email,email_hash,stripe_customer_id,stripe_subscription_id,expires_at) VALUES(?,?,?,?,?,?)')
  .bind(tokenHash,normalized,emailHash,access.customer,access.subscription,expires).run();
 const link=`${origin(env,request)}/api/magic-link/verify?token=${encodeURIComponent(raw)}`;
 try{await sendMagicLinkEmail(env,{to:normalized,url:link});return {sent:true,reason:null}}
 catch(e){await env.DB.prepare('UPDATE magic_link_tokens SET send_error=? WHERE token_hash=?').bind(String(e?.message||e).slice(0,250),tokenHash).run();return {sent:false,reason:'send_failed'}}
}
export async function consumeMagicLink(env,raw){
 if(typeof raw!=='string'||!/^[A-Za-z0-9_-]{40,60}$/.test(raw)||!env?.DB?.prepare)return null;
 const tokenHash=await sha256(raw),now=Math.floor(Date.now()/1000);
 const row=await env.DB.prepare('SELECT email,stripe_customer_id,stripe_subscription_id,expires_at,used_at FROM magic_link_tokens WHERE token_hash=?').bind(tokenHash).first();
 if(!row||row.used_at||Number(row.expires_at)<=now)return null;
 const verified=await verifiedSubscription(env,row.stripe_subscription_id,row.stripe_customer_id);if(!verified)return null;
 const result=await env.DB.prepare('UPDATE magic_link_tokens SET used_at=CURRENT_TIMESTAMP,email=? WHERE token_hash=? AND used_at IS NULL AND expires_at>?').bind('',tokenHash,now).run();
 if(Number(result?.meta?.changes??result?.changes??0)!==1)return null;
 return {customer:row.stripe_customer_id,subscription:row.stripe_subscription_id,status:verified.status};
}
