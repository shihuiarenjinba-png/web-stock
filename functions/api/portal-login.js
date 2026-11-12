import {json,billingMode,LIVE_PORTAL_LOGIN_URL} from '../../server/stripe.js';

export const DEFAULT_TEST_PORTAL_LOGIN='https://billing.stripe.com/p/login/test_7sYaEW1Q36DN9Km1GN93y00';

export function portalLoginUrl(env){
 const mode=billingMode(env);
 const value=mode==='live'
  ?(typeof env?.STRIPE_LIVE_PORTAL_LOGIN_URL==='string'&&env.STRIPE_LIVE_PORTAL_LOGIN_URL.trim()?env.STRIPE_LIVE_PORTAL_LOGIN_URL.trim():LIVE_PORTAL_LOGIN_URL)
  :(typeof env?.STRIPE_PORTAL_LOGIN_URL==='string'&&env.STRIPE_PORTAL_LOGIN_URL.trim()?env.STRIPE_PORTAL_LOGIN_URL.trim():DEFAULT_TEST_PORTAL_LOGIN);
 try{
  const url=new URL(value);
  if(url.protocol!=='https:'||url.hostname!=='billing.stripe.com'||!/^\/p\/login\/[A-Za-z0-9_-]+$/.test(url.pathname)||url.search||url.hash)return null;
  const id=url.pathname.split('/').pop();
  if(mode==='test'&&!id.startsWith('test_'))return null;
  if(mode==='live'&&id.startsWith('test_'))return null;
  return url.toString();
 }catch{return null}
}

export async function onRequestGet({env}){
 const url=portalLoginUrl(env);
 if(!url)return json({error:billingMode(env)==='live'?'Stripe本番契約管理ログインURLが未設定です。':'Stripe契約管理ログインURLが未設定です。'},503);
 return new Response(null,{status:302,headers:{
  'Location':url,
  'Cache-Control':'no-store',
  'Referrer-Policy':'no-referrer',
  'X-Content-Type-Options':'nosniff'
 }});
}
