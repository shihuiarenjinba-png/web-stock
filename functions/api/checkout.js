import {json,isConfigured,validOrigin,origin,stripe,checkoutBrowserState,TEST_MONTHLY_JPY,StripeApiError} from '../../server/stripe.js';
export async function onRequestPost({request,env}){
 if(!isConfigured(env))return json({error:'Stripeテスト接続が未設定です。管理者の設定後に利用できます。'},503);
 if(!validOrigin(request,env))return json({error:'アクセス元を確認できません。'},403);
 try{const site=origin(env,request);const state=await checkoutBrowserState(env,site.startsWith('https:'));const session=await stripe(env,'/checkout/sessions',{
 mode:'subscription',client_reference_id:state.reference, 'line_items[0][quantity]':'1',
 success_url:`${site}/pro/?session_id={CHECKOUT_SESSION_ID}`,cancel_url:`${site}/pro/?checkout=cancelled`,
 'metadata[app]':'demand-scope-pro', 'subscription_data[metadata][app]':'demand-scope-pro',
 'payment_method_types[0]':'card',
 ...(env.STRIPE_PRO_PRICE_ID?{'line_items[0][price]':env.STRIPE_PRO_PRICE_ID}:{
 'line_items[0][price_data][currency]':'jpy',
 'line_items[0][price_data][unit_amount]':String(TEST_MONTHLY_JPY),
 'line_items[0][price_data][product_data][name]':'DemandScope Pro (TEST ONLY)',
 'line_items[0][price_data][recurring][interval]':'month'
 }),
 });
 if(!session.url?.startsWith('https://checkout.stripe.com/'))return json({error:'決済画面のURLを取得できませんでした。'},502);
 return json({url:session.url},200,{'Set-Cookie':state.cookie});
 }catch(e){
  if(e instanceof StripeApiError)return json({
    error:'Stripe Checkoutを開始できません。',
    detail:e.message,
    stripe_type:e.type,
    stripe_code:e.code,
    stripe_param:e.param,
    request_id:e.requestId,
    hint:e.status===403?'制限付きAPIキーのCheckout Sessions権限を確認してください。':e.status===401?'Stripe APIキーが有効なテストキーか確認してください。':'Stripeのテスト設定と権限を確認してください。'
  },502);
  return json({error:'Stripe Checkoutを開始できません。',detail:'Cloudflare側の処理でエラーが発生しました。'},502)
 }
}
