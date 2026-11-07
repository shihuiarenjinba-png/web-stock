import {json,isConfigured,validOrigin,origin,stripe,verifiedSubscription,issueCookie,validCheckoutBrowser} from '../../server/stripe.js';
export async function onRequestPost({request,env}){
 if(!isConfigured(env))return json({error:'Stripeテスト環境が未設定です。'},503);
 if(!validOrigin(request,env))return json({error:'アクセス元を確認できません。'},403);
 let id;try{({session_id:id}=await request.json())}catch{return json({error:'入力が不正です。'},400)}
 if(typeof id!=='string'||!/^cs_test_[A-Za-z0-9_]{5,220}$/.test(id))return json({error:'セッションIDが不正です。'},400);
 try{const sess=await stripe(env,`/checkout/sessions/${encodeURIComponent(id)}`);
 if(!(await validCheckoutBrowser(request,env,sess)))return json({error:'決済を開始したブラウザからもう一度お試しください。'},403);
 if(sess.livemode!==false||sess.mode!=='subscription'||sess.status!=='complete'||!['paid','no_payment_required'].includes(sess.payment_status)||sess.metadata?.app!=='demand-scope-pro'||typeof sess.subscription!=='string'||typeof sess.customer!=='string')return json({error:'有効なテスト決済を確認できませんでした。'},403);
 const sub=await verifiedSubscription(env,sess.subscription,sess.customer);if(!sub)return json({error:'有効なPro契約を確認できませんでした。'},403);
 const secure=origin(env).startsWith('https:');return json({active:true,status:sub.status},200,{'Set-Cookie':await issueCookie(sess.subscription,sess.customer,env,secure)});
 }catch{return json({error:'テスト決済の検証に失敗しました。'},502)}
}
