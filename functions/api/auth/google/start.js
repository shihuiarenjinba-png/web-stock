import {json} from '../../../../server/stripe.js';
import {startGoogleAuthorization,googleConfiguration} from '../../../../server/google-auth.js';

export async function onRequestGet({request,env}){
 const cfg=googleConfiguration(env);
 if(!cfg.configured)return json({error:'Googleログインは設定完了待ちです。',missing:cfg.issues},503);
 try{
  const started=await startGoogleAuthorization(request,env);
  return new Response(null,{status:302,headers:{
   'Location':started.url,
   'Set-Cookie':started.cookie,
   'Cache-Control':'no-store',
   'Referrer-Policy':'no-referrer',
   'X-Content-Type-Options':'nosniff'
  }});
 }catch{return json({error:'Googleログインを開始できませんでした。'},503)}
}
