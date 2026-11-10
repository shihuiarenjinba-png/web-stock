function clean(value){return typeof value==='string'?value.trim():''}
function isLocalHost(hostname){return ['localhost','127.0.0.1','[::1]'].includes(String(hostname||'').toLowerCase())}
function isPlatformHost(hostname){
 const h=String(hostname||'').toLowerCase();
 return h==='pages.dev'||h==='workers.dev'||h.endsWith('.pages.dev')||h.endsWith('.workers.dev');
}
export function configuredAppOrigin(env={}){
 const raw=clean(env.APP_ORIGIN);
 if(!raw)return null;
 try{
  const u=new URL(raw);
  const local=isLocalHost(u.hostname)&&u.protocol==='http:';
  if(!(u.protocol==='https:'||local)||u.username||u.password||u.pathname!=='/'||u.search||u.hash)return null;
  return u.origin;
 }catch{return null}
}
export function requestOrigin(request){
 if(!request)throw new Error('Request required');
 const u=new URL(request.url);
 const local=isLocalHost(u.hostname)&&u.protocol==='http:';
 if(!(u.protocol==='https:'||local))throw new Error('Untrusted URL');
 return u.origin;
}
export function domainStatus(env={}){
 const origin=configuredAppOrigin(env);
 let hostname=null;
 try{hostname=origin?new URL(origin).hostname:null}catch{}
 const local=isLocalHost(hostname);
 const platform=isPlatformHost(hostname);
 const custom=!!origin&&!local&&!platform;
 const enforce=clean(env.DOMAIN_CUTOVER_ENFORCED)==='true';
 const stripeUrlsConfirmed=clean(env.STRIPE_DOMAIN_URLS_CONFIRMED)==='true';
 return {
  configured:!!origin,
  origin,
  hostname,
  custom_domain:custom,
  platform_hostname:platform,
  cutover_enforced:enforce,
  stripe_dashboard_urls_confirmed:stripeUrlsConfirmed,
  ready_for_domain_cutover:custom&&stripeUrlsConfirmed
 };
}
export function canonicalOrRequestOrigin(env,request){
 return configuredAppOrigin(env)||requestOrigin(request);
}
export function requestAllowedForDomainCutover(env,request){
 const status=domainStatus(env);
 if(!status.cutover_enforced)return true;
 if(!status.custom_domain||!status.origin)return false;
 try{return requestOrigin(request)===status.origin}catch{return false}
}
