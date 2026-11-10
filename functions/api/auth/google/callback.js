import {origin} from '../../../../server/stripe.js';
import {completeGoogleCallback,clearGoogleFlowCookie} from '../../../../server/google-auth.js';

function redirect(request,env,status,cookies=[]){
 const target=new URL('/pro/?google='+encodeURIComponent(status),origin(env,request));
 const headers=new Headers({'Location':target.toString(),'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});
 for(const cookie of cookies)headers.append('Set-Cookie',cookie);
 return new Response(null,{status:302,headers});
}

export async function onRequestGet({request,env}){
 const clear=clearGoogleFlowCookie(request,env);
 const url=new URL(request.url);
 if(url.searchParams.get('error'))return redirect(request,env,'cancelled',[clear]);
 try{
   const result=await completeGoogleCallback(request,env);
   return redirect(request,env,'ok',[clear,result.cookie]);
 }catch{
   return redirect(request,env,'invalid',[clear]);
 }
}
