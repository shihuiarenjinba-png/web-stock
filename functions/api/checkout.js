import {json,isConfigured,validOrigin,origin,stripe,checkoutBrowserState,TEST_MONTHLY_JPY,StripeApiError,billingMode,activePriceId} from '../../server/stripe.js';
import {LEGAL_VERSION} from '../../server/legal.js';
import {authConfigured,authenticatedMember} from '../../server/auth.js';
function validBuyerEmail(value){return typeof value==='string'&&value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)}
export async function onRequestPost({request,env}){
 const mode=billingMode(env),priceId=activePriceId(env);
 if(!isConfigured(env))return json({error:mode==='live'?'Stripe本番接続が未設定です。管理者の設定後に利用できます。':'Stripeテスト接続が未設定です。管理者の設定後に利用できます。'},503);
 if(!validOrigin(request,env))return json({error:'アクセス元を確認できません。'},403);
 let input={};try{input=await request.json()}catch{}
 if(input?.accept_terms!==true)return json({error:'利用規約・プライバシーポリシー・課金条件への同意が必要です。'},400);
 let member=null;
 if(authConfigured(env)){try{member=await authenticatedMember(request,env)}catch{}}
 if(env?.AUTH_REQUIRED==='true'&&!member)return json({error:'Googleログインが必要です。'},401);
 const buyerEmail=member?.email||String(input?.buyer_email||'').trim().toLowerCase();
 if(!member&&!validBuyerEmail(buyerEmail))return json({error:'購入者メールアドレスを正しく入力してください。'},400);
 try{const site=origin(env,request);const state=await checkoutBrowserState(env,site.startsWith('https:'));const session=await stripe(env,'/checkout/sessions',{
 mode:'subscription',client_reference_id:state.reference, 'line_items[0][quantity]':'1',
 success_url:`${site}/pro/?session_id={CHECKOUT_SESSION_ID}`,cancel_url:`${site}/pro/?checkout=cancelled`,
 'metadata[app]':'demand-scope-pro', 'metadata[legal_version]':LEGAL_VERSION, 'metadata[legal_accepted_at]':String(Math.floor(Date.now()/1000)),
 'subscription_data[metadata][app]':'demand-scope-pro', 'subscription_data[metadata][legal_version]':LEGAL_VERSION,
 ...(member?{'metadata[member_id]':member.id,'subscription_data[metadata][member_id]':member.id}:{}),
 ...(member?.stripe_customer_id?{customer:member.stripe_customer_id}:{customer_email:buyerEmail}),
 'payment_method_types[0]':'card',
 'wallet_options[link][display]':'never',
 ...(priceId?{'line_items[0][price]':priceId}:{
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
    hint:e.status===403?'制限付きAPIキーのCheckout Sessions権限を確認してください。':e.status===401?(mode==='live'?'Stripe本番APIキーが有効か確認してください。':'Stripe APIキーが有効なテストキーか確認してください。'):(mode==='live'?'Stripeの本番設定と権限を確認してください。':'Stripeのテスト設定と権限を確認してください。')
  },502);
  return json({error:'Stripe Checkoutを開始できません。',detail:'Cloudflare側の処理でエラーが発生しました。'},502)
 }
}
