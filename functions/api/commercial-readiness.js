import {json,configurationDiagnostics} from '../../server/stripe.js';
import {authConfigured} from '../../server/auth.js';

export async function onRequestGet({env}){
 let d1SchemaOk=false,d1Error=null;
 if(env.DB?.prepare){try{const row=await env.DB.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name IN ('members','subscriptions','stripe_events','checkout_acceptances')").first();d1SchemaOk=Number(row?.n)===4}catch(e){d1Error=String(e?.message||e).slice(0,160)}}
 const stripeIssues=configurationDiagnostics(env);
 const legal={
  operator_name:!!env.LEGAL_OPERATOR_NAME,
  address:!!env.LEGAL_ADDRESS,
  phone:!!env.LEGAL_PHONE,
  support_email:!!env.SUPPORT_EMAIL
 };
 const auth={google_client_id:!!env.GOOGLE_CLIENT_ID,google_client_secret:!!env.GOOGLE_CLIENT_SECRET,configured:authConfigured(env),required:env?.AUTH_REQUIRED==='true'};
 const billing={stripe_test_configured:stripeIssues.length===0,webhook_secret:typeof env.STRIPE_WEBHOOK_SECRET==='string'&&env.STRIPE_WEBHOOK_SECRET.startsWith('whsec_'),d1_binding:!!env.DB,d1_schema_ok:d1SchemaOk,d1_error:d1Error,live_billing_enabled:false};
 const readyForBillingTest=billing.stripe_test_configured&&billing.webhook_secret&&billing.d1_binding&&billing.d1_schema_ok;
 const readyForUnattendedTest=readyForBillingTest&&auth.configured;
 const readyForLive=false;
 return json({environment:'test',ready_for_billing_test:readyForBillingTest,ready_for_unattended_test:readyForUnattendedTest,ready_for_live:readyForLive,billing,auth,legal,notes:['Live billing remains intentionally disabled.','Legal operator details and authenticated member mapping are required before live sales.']});
}
