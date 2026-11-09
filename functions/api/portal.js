import {json,isConfigured,validOrigin,origin,stripe,billingMode} from '../../server/stripe.js';
import {resolveEntitlement} from '../../server/access.js';
export async function onRequestPost({request,env}){
 const mode=billingMode(env);
 if(!isConfigured(env))return json({error:'設定が未完了です。'},503);
 if(!validOrigin(request,env))return json({error:'アクセス元を確認できません。'},403);
 try{
  const a=await resolveEntitlement(request,env);if(!a)return json({error:'契約の確認が必要です。'},401);
  const config=mode==='live'?env.STRIPE_LIVE_PORTAL_CONFIG_ID:(env.STRIPE_PORTAL_CONFIG_ID||'bpc_1UZ2FNBGa8rL8jwIBPFuUkWT');
  if(!/^bpc_[A-Za-z0-9]+$/.test(config||''))return json({error:mode==='live'?'本番用Stripeポータル設定IDが未設定です。':'ポータル設定IDが不正です。'},503);
  const session=await stripe(env,'/billing_portal/sessions',{
   customer:a.customer,
   return_url:`${origin(env,request)}/pro/`,
   configuration:config,
   locale:'ja',
   'after_expiration[type]':'customer_login'
  });
  if(!session.url?.startsWith('https://billing.stripe.com/'))return json({error:'管理画面を開けません。'},502);
  return json({url:session.url})
 }catch{return json({error:'契約管理画面への接続に失敗しました。'},502)}
}
