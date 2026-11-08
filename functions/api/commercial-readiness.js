import {json,configurationDiagnostics} from '../../server/stripe.js';

export async function onRequestGet({env}){
 const stripeIssues=configurationDiagnostics(env);
 const legal={
  operator_name:!!env.LEGAL_OPERATOR_NAME,
  address:!!env.LEGAL_ADDRESS,
  phone:!!env.LEGAL_PHONE,
  support_email:!!env.SUPPORT_EMAIL
 };
 const auth={google_client_id:!!env.GOOGLE_CLIENT_ID,google_client_secret:!!env.GOOGLE_CLIENT_SECRET};
 const billing={stripe_test_configured:stripeIssues.length===0,webhook_secret:typeof env.STRIPE_WEBHOOK_SECRET==='string'&&env.STRIPE_WEBHOOK_SECRET.startsWith('whsec_'),d1_binding:!!env.DB,live_billing_enabled:false};
 const readyForUnattendedTest=billing.stripe_test_configured&&billing.webhook_secret&&billing.d1_binding;
 const readyForLive=false;
 return json({environment:'test',ready_for_unattended_test:readyForUnattendedTest,ready_for_live:readyForLive,billing,auth,legal,notes:['Live billing remains intentionally disabled.','Legal operator details and authenticated member mapping are required before live sales.']});
}
