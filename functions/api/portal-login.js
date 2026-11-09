import {json} from '../../server/stripe.js';

export const DEFAULT_TEST_PORTAL_LOGIN='https://billing.stripe.com/p/login/test_7sYaEW1Q36DN9Km1GN93y00';

export function portalLoginUrl(env){
 const value=typeof env?.STRIPE_PORTAL_LOGIN_URL==='string'&&env.STRIPE_PORTAL_LOGIN_URL.trim()
  ?env.STRIPE_PORTAL_LOGIN_URL.trim()
  :DEFAULT_TEST_PORTAL_LOGIN;
 try{
  const url=new URL(value);
  if(url.protocol!=='https:'||url.hostname!=='billing.stripe.com'||!/^\/p\/login\/test_[A-Za-z0-9]+$/.test(url.pathname)||url.search||url.hash)return null;
  return url.toString();
 }catch{return null}
}

export async function onRequestGet({env}){
 const url=portalLoginUrl(env);
 if(!url)return json({error:'Stripe契約管理ログインURLが未設定です。'},503);
 return new Response(null,{status:302,headers:{
  'Location':url,
  'Cache-Control':'no-store',
  'Referrer-Policy':'no-referrer',
  'X-Content-Type-Options':'nosniff'
 }});
}
