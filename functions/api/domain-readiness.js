import {json} from '../../server/stripe.js';
import {domainStatus} from '../../server/domain.js';

export async function onRequestGet({env}){
 const domain=domainStatus(env);
 const notes=[];
 if(!domain.custom_domain)notes.push('APP_ORIGIN is not yet an HTTPS custom domain.');
 if(domain.custom_domain&&!domain.stripe_dashboard_urls_confirmed)notes.push('Update Stripe Product, Portal and Webhook URLs to the custom domain, then set STRIPE_DOMAIN_URLS_CONFIRMED=true.');
 if(domain.ready_for_domain_cutover&&!domain.cutover_enforced)notes.push('Custom-domain dependencies are prepared. Run browser/payment smoke tests before DOMAIN_CUTOVER_ENFORCED=true.');
 return json({service:'demandscope',domain,notes});
}
