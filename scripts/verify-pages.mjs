/** Deployment gate: build only for Cloudflare Pages, not Workers Builds. */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const required = [
  'public/index.html',
  'public/pro/index.html',
  'public/_headers',
  'public/robots.txt',
  'public/sitemap.xml',
  'public/deploy-version.json',
  'public/legal/terms/index.html',
  'public/legal/privacy/index.html',
  'public/legal/commerce/index.html',
  'public/legal/billing/index.html',
  'public/assets/app.js',
  'public/assets/pro.js',
  'public/assets/logic.js',
  'public/assets/importer.js',
  'public/assets/i18n.js',
  'public/assets/chart.js',
  'public/assets/style.css',
  'public/assets/jszip.min.js',
  'server/stripe.js',
  'server/subscription-store.js',
  'server/legal.js',
  'server/auth.js',
  'server/access.js',
  'migrations/0001_commercial_core.sql',
  'migrations/0002_checkout_acceptance.sql',
  'migrations/0003_member_stripe_link.sql',
  'functions/api/checkout.js',
  'functions/api/activate.js',
  'functions/api/entitlement.js',
  'functions/api/portal.js',
  'functions/api/portal-login.js',
  'functions/api/logout.js',
  'functions/api/stripe-webhook.js',
  'functions/api/commercial-readiness.js',
  'functions/api/auth/login.js',
  'functions/api/auth/callback.js',
  'functions/api/auth/me.js',
  'functions/api/auth/logout.js',
];
for (const path of required) {
  const full = resolve(root, path);
  if (!existsSync(full) || !statSync(full).isFile() || statSync(full).size === 0) {
    throw new Error(`Missing or empty Pages asset/Function: ${path}`);
  }
}
for (const file of ['public/index.html', 'public/pro/index.html', 'public/legal/terms/index.html', 'public/legal/privacy/index.html', 'public/legal/commerce/index.html', 'public/legal/billing/index.html']) {
  const html = readFileSync(resolve(root, file), 'utf8');
  // Check only local root-relative linked JS/CSS assets; ignore external URLs.
  for (const [, path] of html.matchAll(/(?:src|href)=["'](\/assets\/[^"'?#]+)["']/g)) {
    if (!existsSync(resolve(root, 'public', path.slice(1)))) throw new Error(`Broken ${file} asset: ${path}`);
  }
}
if (existsSync(resolve(root, 'public/_worker.js'))) {
  throw new Error('Do not mix Pages Functions with a _worker.js script without reviewing routing.');
}
if (existsSync(resolve(root, 'wrangler.toml')) || existsSync(resolve(root, 'wrangler.jsonc'))) {
  throw new Error('This repository uses Pages Git integration; do not add a Worker deploy config accidentally.');
}
console.log('PASS Cloudflare Pages layout (public/ + functions/). No Worker deployment configuration.');

const proHtml = readFileSync(resolve(root, 'public/pro/index.html'), 'utf8');
if (!/noindex,nofollow/.test(proHtml)) throw new Error('Pro surface must remain noindex,nofollow.');
if (!/自動更新/.test(proHtml)) throw new Error('Pro checkout surface must disclose recurring billing.');
const commerceHtml = readFileSync(resolve(root, 'public/legal/commerce/index.html'), 'utf8');
if (!/本番販売開始前に掲載/.test(commerceHtml)) throw new Error('Test-stage commerce disclosure must not pretend live operator details are complete.');

if (!/id="legalConsent"/.test(proHtml)) throw new Error('Pro checkout must require explicit legal consent.');

if (!/id="memberAuth"/.test(proHtml)) throw new Error('Pro surface must include member authentication UI.');
if (!/id="buyerEmail"/.test(proHtml)) throw new Error('Pro checkout must collect an explicit buyer email.');
if (!/10分以上届かない場合/.test(proHtml)) throw new Error('Pro surface must explain Stripe portal email delay and recovery guidance.');
