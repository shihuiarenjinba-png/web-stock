import {json,isConfigured,validOrigin,origin,stripe,checkoutBrowserState,TEST_MONTHLY_JPY,StripeApiError,billingMode,activePriceId,verifyLivePrice,isPublicProductionRequest} from '../../server/stripe.js';
import {LEGAL_VERSION} from '../../server/legal.js';
import {authenticatedMember,googleConfiguration} from '../../server/google-auth.js';
import {reserveDemandScopeCapacity,releaseDemandScopeReservation} from '../../server/capacity.js';
function validBuyerEmail(value){return typeof value==='string'&&value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)}
export async function onRequestPost({request,env}){
 const mode=billingMode(env),priceId=activePriceId(env);
 if(mode!=='live'&&isPublicProductionRequest(request))return json({error:'DemandScope Pro は販売開始直前のため、新規決済を一時停止しています。',code:'production_prelive_locked'},503);
 if(!isConfigured(env))return json({error:mode==='live'?'Stripe本番接続が未設定です。管理者の設定後に利用できます。':'Stripeテスト接続が未設定です。管理者の設定後に利用できます。'},503);
 if(!validOrigin(request,env))return json({error:'アクセス元を確認できません。'},403);
 let input={};try{input=await request.json()}catch{}
 const googleCfg=googleConfiguration(env);const member=await authenticatedMember(request,env);
 if(mode==='live'&&!googleCfg.configured)return json({error:'Google本人認証の本番設定が未完了です。販売開始を停止しています。',auth_not_configured:true,issues:googleCfg.issues},503);
 if((mode==='live'||googleCfg.configured)&&!member)return json({error:'Googleでログインしてから決済へ進んでください。',auth_required:true},401);
 if(input?.accept_terms!==true)return json({error:'利用規約・プライバシーポリシー・課金条件への同意が必要です。'},400);
 const buyerEmail=String(input?.buyer_email||'').trim().toLowerCase();
 if(!validBuyerEmail(buyerEmail))return json({error:'購入者メールアドレスを正しく入力してください。'},400);
 let reservation=null;
 try{
  if(mode==='live'){
   const verified=await verifyLivePrice(env);
   if(!verified.ok)return json({error:'本番価格設定を安全に確認できません。',detail:'DemandScope Pro は月額980円のLive Priceとして確認できるまで決済を開始しません。',price_check:verified.reason},503);
   if(!env.DB?.prepare)return json({error:'販売枠の確認用データベースに接続できません。新規購入を安全のため停止しています。'},503);
   try{reservation=await reserveDemandScopeCapacity(env.DB,{memberId:member.id,priceId});}
   catch{return json({error:'販売枠を確認できません。新規購入を安全のため停止しています。'},503)}
   if(!reservation.ok){
    return json({
     error:reservation.reason==='already_subscribed'?'すでにDemandScope Proを契約中です。':'初期Pro販売枠が満員です。解約等で枠が空くまで新規受付を停止しています。',
     code:reservation.reason,capacity:reservation.snapshot||null
    },409);
   }
  }
  const site=origin(env,request);const state=await checkoutBrowserState(env,site.startsWith('https:'));const session=await stripe(env,'/checkout/sessions',{
 mode:'subscription',client_reference_id:state.reference, 'line_items[0][quantity]':'1',
 success_url:`${site}/pro/?session_id={CHECKOUT_SESSION_ID}`,cancel_url:`${site}/pro/?checkout=cancelled`,
 'metadata[app]':'demand-scope-pro', 'metadata[legal_version]':LEGAL_VERSION, 'metadata[legal_accepted_at]':String(Math.floor(Date.now()/1000)),
 ...(member?{'metadata[member_id]':member.id}:{}),
 ...(reservation?.reservationId?{'metadata[capacity_reservation_id]':reservation.reservationId}:{}),
 'subscription_data[metadata][app]':'demand-scope-pro', 'subscription_data[metadata][legal_version]':LEGAL_VERSION,
 ...(member?{'subscription_data[metadata][member_id]':member.id}:{}),
 ...(reservation?.reservationId?{'subscription_data[metadata][capacity_reservation_id]':reservation.reservationId}:{}),
 customer_email:buyerEmail,
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
  if(reservation?.reservationId)try{await releaseDemandScopeReservation(env.DB,reservation.reservationId)}catch{}
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
