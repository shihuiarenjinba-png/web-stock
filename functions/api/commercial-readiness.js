import {json,configurationDiagnostics,billingMode,stripe,StripeApiError,activePriceId,verifyLivePrice,LIVE_MONTHLY_JPY,LIVE_APP_ORIGIN} from '../../server/stripe.js';
import {DEFAULT_DISCLOSURE_REQUEST_URL,REFUND_POLICY_CONFIRMED_IN_CODE,REAL_CARD_E2E_WAIVED_BY_OWNER} from '../../server/legal.js';
import {authMailGatewayConfig,gatewayHealth} from '../../server/auth-mail-gateway.js';
import {googleConfiguration} from '../../server/google-auth.js';

export async function onRequestGet({env}){
 let d1SchemaOk=false,d1Error=null,webhookBacklog=null,webhookLastError=null,webhookLastEventType=null;
 if(env.DB?.prepare){try{
  const row=await env.DB.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name IN ('members','subscriptions','stripe_events','checkout_acceptances')").first();
  d1SchemaOk=Number(row?.n)===4;
  if(d1SchemaOk){
   const backlog=await env.DB.prepare("SELECT COUNT(*) AS n FROM stripe_events WHERE processed_at IS NULL").first();
   webhookBacklog=Number(backlog?.n)||0;
   const last=await env.DB.prepare("SELECT event_type,last_error FROM stripe_events WHERE processed_at IS NULL ORDER BY received_at DESC LIMIT 1").first();
   webhookLastError=typeof last?.last_error==='string'?last.last_error.slice(0,160):null;
   webhookLastEventType=typeof last?.event_type==='string'?last.event_type:null;
  }
 }catch(e){d1Error=String(e?.message||e).slice(0,160)}}

 const mode=billingMode(env),stripeIssues=configurationDiagnostics(env),priceId=activePriceId(env);
 const disclosureUrl=(typeof env.LEGAL_DISCLOSURE_URL==='string'&&env.LEGAL_DISCLOSURE_URL.trim())||DEFAULT_DISCLOSURE_REQUEST_URL;
 const explicitOperator=!!env.LEGAL_OPERATOR_NAME&&!!env.LEGAL_ADDRESS&&!!env.LEGAL_PHONE;
 const disclosureOnRequest=typeof disclosureUrl==='string'&&/^https:\/\//.test(disclosureUrl);
 const legal={
  explicit_operator_details:explicitOperator,
  disclosure_on_request:disclosureOnRequest,
  disclosure_url:disclosureOnRequest?disclosureUrl:null,
  refund_policy_confirmed:REFUND_POLICY_CONFIRMED_IN_CODE===true||env.REFUND_POLICY_CONFIRMED==='true',
  support_channel:!!env.SUPPORT_EMAIL||!!env.SUPPORT_URL||disclosureOnRequest
 };
 const testWebhook=typeof (env.STRIPE_TEST_WEBHOOK_SECRET||env.STRIPE_WEBHOOK_SECRET)==='string'&&(env.STRIPE_TEST_WEBHOOK_SECRET||env.STRIPE_WEBHOOK_SECRET).startsWith('whsec_');
 const liveWebhook=typeof env.STRIPE_LIVE_WEBHOOK_SECRET==='string'&&env.STRIPE_LIVE_WEBHOOK_SECRET.startsWith('whsec_');
 let account={checked:false,charges_enabled:null,payouts_enabled:null,details_submitted:null,error:null};
 let livePrice={checked:false,verified:false,reason:null,expected_jpy:LIVE_MONTHLY_JPY};
 if(mode==='live'&&stripeIssues.length===0){try{
   const [a,p]=await Promise.all([stripe(env,'/account'),verifyLivePrice(env)]);
   account={checked:true,charges_enabled:a.charges_enabled===true,payouts_enabled:a.payouts_enabled===true,details_submitted:a.details_submitted===true,error:null};
   livePrice={checked:true,verified:p.ok===true,reason:p.reason||null,expected_jpy:LIVE_MONTHLY_JPY};
 }catch(e){account.error=e instanceof StripeApiError?(e.code||e.message):String(e?.message||e).slice(0,160);livePrice={checked:true,verified:false,reason:'stripe_error',expected_jpy:LIVE_MONTHLY_JPY}}}
 const google=googleConfiguration(env);
 const appOrigin=(typeof env.APP_ORIGIN==='string'&&env.APP_ORIGIN.trim())|| (mode==='live'?LIVE_APP_ORIGIN:'');
 const originReady=mode!=='live'||(/^https:\/\//.test(appOrigin)&&!appOrigin.endsWith('/'));
 const billing={
  mode,
  stripe_configured:stripeIssues.length===0,
  configured_price_id:priceId||null,
  test_webhook_secret:testWebhook,
  live_webhook_secret:liveWebhook,
  d1_binding:!!env.DB,
  d1_schema_ok:d1SchemaOk,
  d1_error:d1Error,
  webhook_backlog:webhookBacklog,
  webhook_last_event_type:webhookLastEventType,
  webhook_last_error:webhookLastError,
  live_billing_enabled:mode==='live',
  account,
  live_price:livePrice
 };
 const readyForBillingTest=mode==='test'&&billing.stripe_configured&&testWebhook&&billing.d1_binding&&billing.d1_schema_ok;
 const readyForUnattendedTest=readyForBillingTest;
 const legalReady=(legal.explicit_operator_details||legal.disclosure_on_request)&&legal.refund_policy_confirmed&&legal.support_channel;
 const readyForLive=mode==='live'&&billing.stripe_configured&&liveWebhook&&billing.d1_binding&&billing.d1_schema_ok&&webhookBacklog===0&&legalReady&&livePrice.verified===true&&account.charges_enabled===true&&account.payouts_enabled===true&&account.details_submitted===true&&google.configured&&originReady;
 const notes=[];
 if(mode!=='live')notes.push('Live billing is still gated off.');
 if(!priceId&&mode==='live')notes.push('A live recurring Stripe Price ID is required.');
 if(mode==='live'&&livePrice.checked&&!livePrice.verified)notes.push('Live Price must be an active DemandScope Pro JPY 980 monthly price.');
 if(!legal.refund_policy_confirmed)notes.push('Refund policy must be explicitly confirmed before live sales.');
 if(mode==='live'&&account.checked&&account.payouts_enabled!==true)notes.push('Stripe payouts must be enabled before live launch.');
 if(mode==='live'&&!google.configured)notes.push('Google OAuth must be fully configured before live sales.');
 if(mode==='live'&&!originReady)notes.push('APP_ORIGIN must be the exact canonical HTTPS origin before live sales.');
 const gatewayCfg=authMailGatewayConfig(env);const gateway=gatewayCfg.configured?await gatewayHealth(env):{reachable:false,ready:false,configured:false};
 const access={provider:'stripe',checkout_browser_activation:true,customer_portal_email_login:true,cross_device_app_login:gateway.ready===true,magic_link:{provider:'auth-mail-gateway',configured:gatewayCfg.configured,gateway_reachable:gateway.reachable===true,gateway_ready:gateway.ready===true,sender_domain:gateway.ready?gateway.sender_domain:null,ttl_minutes:10}};
 if(!gateway.ready)notes.push('Stripe Customer Portal handles billing only. Cross-device Pro restoration remains disabled until the shared Auth Mail Gateway is configured and ready.');
 return json({environment:mode,ready_for_billing_test:readyForBillingTest,ready_for_unattended_test:readyForUnattendedTest,ready_for_live:readyForLive,billing,identity:{provider:'google',configured:google.configured,issues:google.issues,canonical_origin_ready:originReady,app_origin:appOrigin||null},access,legal,launch_evidence:{real_card_e2e_waived_by_owner:REAL_CARD_E2E_WAIVED_BY_OWNER===true},notes});
}
