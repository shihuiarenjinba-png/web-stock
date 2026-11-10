import {issueCookie,origin} from '../../../server/stripe.js';
import {findActiveDemandScopeSubscription} from '../../../server/subscription-lookup.js';
import {authMailGatewayConfig,consumeGatewayAssertion} from '../../../server/auth-mail-gateway.js';

function redirect(request,path,cookies=[]){
 const url=new URL(path,origin({},request));
 const headers=new Headers({'Location':url.toString(),'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});
 for(const cookie of cookies)if(cookie)headers.append('Set-Cookie',cookie);
 return new Response(null,{status:302,headers});
}

export async function onRequestGet({request,env}){
 const cfg=authMailGatewayConfig(env);
 if(!cfg.configured)return redirect(request,'/pro/?magic=unavailable');
 const code=new URL(request.url).searchParams.get('code')||'';
 if(!/^[A-Za-z0-9_-]{40,96}$/.test(code))return redirect(request,'/pro/?magic=invalid');
 try{
  const assertion=await consumeGatewayAssertion(env,code);
  const email=typeof assertion?.email==='string'?assertion.email:'';
  if(assertion?.verified!==true||!email)return redirect(request,'/pro/?magic=invalid');
  const access=await findActiveDemandScopeSubscription(env,email);
  if(!access)return redirect(request,'/pro/?magic=invalid');
  const secure=origin(env,request).startsWith('https:');
  return redirect(request,'/pro/?magic=ok',[await issueCookie(access.subscription,access.customer,env,secure)]);
 }catch{return redirect(request,'/pro/?magic=invalid')}
}
