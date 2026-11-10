import {issueCookie,origin} from '../../../server/stripe.js';
import {findActiveDemandScopeSubscription} from '../../../server/subscription-lookup.js';
import {authMailGatewayConfig,consumeGatewayAssertion} from '../../../server/auth-mail-gateway.js';

function redirect(request,path,cookies=[]){
 const url=new URL(path,origin({},request));
 const headers=new Headers({'Location':url.toString(),'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});
 for(const cookie of cookies)if(cookie)headers.append('Set-Cookie',cookie);
 return new Response(null,{status:302,headers});
}
function stateCookie(request){
 return request.headers.get('Cookie')?.match(/(?:^|;\s*)demand_magic_state=([A-Za-z0-9_-]{40,96})/)?.[1]||'';
}
function clearStateCookie(secure){
 return `demand_magic_state=; Path=/api/magic-link/callback; Max-Age=0; HttpOnly; SameSite=Lax${secure?'; Secure':''}`;
}

export async function onRequestGet({request,env}){
 const secure=origin(env,request).startsWith('https:');
 const clear=clearStateCookie(secure);
 const cfg=authMailGatewayConfig(env);
 if(!cfg.configured)return redirect(request,'/pro/?magic=unavailable',[clear]);
 const url=new URL(request.url);
 const code=url.searchParams.get('code')||'';
 const state=url.searchParams.get('state')||'';
 const expected=stateCookie(request);
 if(!/^[A-Za-z0-9_-]{40,96}$/.test(code)||!/^[A-Za-z0-9_-]{40,96}$/.test(state)||!expected||state!==expected){
  return redirect(request,'/pro/?magic=invalid',[clear]);
 }
 try{
  const assertion=await consumeGatewayAssertion(env,code);
  const email=typeof assertion?.email==='string'?assertion.email:'';
  if(assertion?.verified!==true||!email)return redirect(request,'/pro/?magic=invalid',[clear]);
  const access=await findActiveDemandScopeSubscription(env,email);
  if(!access)return redirect(request,'/pro/?magic=invalid',[clear]);
  return redirect(request,'/pro/?magic=ok',[clear,await issueCookie(access.subscription,access.customer,env,secure)]);
 }catch{return redirect(request,'/pro/?magic=invalid',[clear])}
}
