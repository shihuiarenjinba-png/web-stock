import {json,isConfigured,validOrigin,origin,stripe,checkoutBrowserState} from '../../server/stripe.js';
export async function onRequestPost({request,env}){
 if(!isConfigured(env))return json({error:'Stripeテスト接続が未設定です。管理者の設定後に利用できます。'},503);
 if(!validOrigin(request,env))return json({error:'アクセス元を確認できません。'},403);
 try{const site=origin(env);const state=await checkoutBrowserState(env,site.startsWith('https:'));const session=await stripe(env,'/checkout/sessions',{
 mode:'subscription',client_reference_id:state.reference, 'line_items[0][price]':env.STRIPE_PRO_PRICE_ID,'line_items[0][quantity]':'1',
 success_url:`${site}/pro/?session_id={CHECKOUT_SESSION_ID}`,cancel_url:`${site}/pro/?checkout=cancelled`,
 'metadata[app]':'demand-scope-pro', 'subscription_data[metadata][app]':'demand-scope-pro',
 'payment_method_types[0]':'card',
 });
 if(!session.url?.startsWith('https://checkout.stripe.com/'))return json({error:'決済画面のURLを取得できませんでした。'},502);
 return json({url:session.url},200,{'Set-Cookie':state.cookie});
 }catch(e){return json({error:'Stripe Checkoutを開始できません。設定・価格IDを確認してください。'},502)}
}
