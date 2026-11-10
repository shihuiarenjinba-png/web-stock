import test from 'node:test';
import assert from 'node:assert/strict';
import {configuredAppOrigin,domainStatus,canonicalOrRequestOrigin,requestAllowedForDomainCutover} from '../server/domain.js';

test('custom HTTPS origin is accepted as canonical origin',()=>{
 const env={APP_ORIGIN:'https://demand.example.com'};
 assert.equal(configuredAppOrigin(env),'https://demand.example.com');
 assert.equal(domainStatus(env).custom_domain,true);
});
test('pages.dev and workers.dev do not count as final custom domains',()=>{
 assert.equal(domainStatus({APP_ORIGIN:'https://web-stock.pages.dev'}).custom_domain,false);
 assert.equal(domainStatus({APP_ORIGIN:'https://web-stock.example.workers.dev'}).custom_domain,false);
});
test('canonical app origin wins over the request host for Stripe return URLs',()=>{
 const env={APP_ORIGIN:'https://demand.example.com'};
 const req=new Request('https://legacy.pages.dev/api/checkout');
 assert.equal(canonicalOrRequestOrigin(env,req),'https://demand.example.com');
});
test('domain enforcement rejects legacy-host commercial requests after cutover',()=>{
 const env={APP_ORIGIN:'https://demand.example.com',DOMAIN_CUTOVER_ENFORCED:'true'};
 assert.equal(requestAllowedForDomainCutover(env,new Request('https://legacy.pages.dev/api/checkout')),false);
 assert.equal(requestAllowedForDomainCutover(env,new Request('https://demand.example.com/api/checkout')),true);
});
test('domain readiness also requires Stripe dashboard URL confirmation',()=>{
 const base={APP_ORIGIN:'https://demand.example.com'};
 assert.equal(domainStatus(base).ready_for_domain_cutover,false);
 assert.equal(domainStatus({...base,STRIPE_DOMAIN_URLS_CONFIRMED:'true'}).ready_for_domain_cutover,true);
});
test('path-bearing and insecure public origins fail closed',()=>{
 assert.equal(configuredAppOrigin({APP_ORIGIN:'https://example.com/app'}),null);
 assert.equal(configuredAppOrigin({APP_ORIGIN:'http://example.com'}),null);
});
