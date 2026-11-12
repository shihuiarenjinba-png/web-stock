import {json,isConfigured,validOrigin,origin,stripe,verifiedSubscription,issueCookie,validCheckoutBrowser,billingMode,expectedLivemode} from '../../server/stripe.js';
import {authenticatedMember,linkMemberStripeCustomer} from '../../server/google-auth.js';
export async function onRequestPost({request,env}){
 const mode=billingMode(env),live=expectedLivemode(env);
 if(!isConfigured(env))return json({error:mode==='live'?'Stripe本番環境が未設定です。':'Stripeテスト環境が未設定です。'},503);
 if(!validOrigin(request,env))return json({error:'アクセス元を確認できません。'},403);
 let id;try{({session_id:id}=await request.json())}catch{return json({error:'入力が不正です。'},400)}
 const prefix=live?'cs_live_':'cs_test_';
 if(typeof id!=='string'||!id.startsWith(prefix)||!/^cs_(?:test|live)_[A-Za-z0-9_]{5,220}$/.test(id))return json({error:'セッションIDが不正です。'},400);
 try{const sess=await stripe(env,`/checkout/sessions/${encodeURIComponent(id)}`);
 if(!(await validCheckoutBrowser(request,env,sess)))return json({error:'決済を開始したブラウザからもう一度お試しください。'},403);
 if(sess.livemode!==live||sess.mode!=='subscription'||sess.status!=='complete'||!['paid','no_payment_required'].includes(sess.payment_status)||sess.metadata?.app!=='demand-scope-pro'||typeof sess.subscription!=='string'||typeof sess.customer!=='string')return json({error:mode==='live'?'有効な本番決済を確認できませんでした。':'有効なテスト決済を確認できませんでした。'},403);
 const sub=await verifiedSubscription(env,sess.subscription,sess.customer);if(!sub)return json({error:'有効なPro契約を確認できませんでした。'},403);
 const linkedMember=typeof sess.metadata?.member_id==='string'?sess.metadata.member_id:null;
 if(live&&!linkedMember)return json({error:'本番決済にGoogle会員IDが紐付いていません。Pro開放を停止しました。'},403);
 if(linkedMember){
   const member=await authenticatedMember(request,env);
   if(!member||member.id!==linkedMember)return json({error:'決済を開始したGoogleアカウントでログインしてください。'},403);
   await linkMemberStripeCustomer(env,member.id,sess.customer);
 }
 const secure=origin(env,request).startsWith('https:');return json({active:true,status:sub.status},200,{'Set-Cookie':await issueCookie(sess.subscription,sess.customer,env,secure)});
 }catch{return json({error:mode==='live'?'本番決済の検証に失敗しました。':'テスト決済の検証に失敗しました。'},502)}
}
