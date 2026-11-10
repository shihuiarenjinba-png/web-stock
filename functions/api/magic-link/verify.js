import {issueCookie,origin} from '../../../server/stripe.js';
import {consumeMagicLink,magicLinkConfig} from '../../../server/magic-link.js';

function redirect(request,path,cookie){
 const url=new URL(path,origin({},request));
 const headers=new Headers({'Location':url.toString(),'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});
 if(cookie)headers.set('Set-Cookie',cookie);
 return new Response(null,{status:302,headers});
}
export async function onRequestGet({request,env}){
 const cfg=magicLinkConfig(env);if(!cfg.configured)return redirect(request,'/pro/?magic=unavailable');
 const raw=new URL(request.url).searchParams.get('token')||'';
 try{
  const access=await consumeMagicLink(env,raw);
  if(!access)return redirect(request,'/pro/?magic=invalid');
  const secure=origin(env,request).startsWith('https:');
  return redirect(request,'/pro/?magic=ok',await issueCookie(access.subscription,access.customer,env,secure));
 }catch{return redirect(request,'/pro/?magic=invalid')}
}
