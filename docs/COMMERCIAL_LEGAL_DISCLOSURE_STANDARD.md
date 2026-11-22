# Commercial legal disclosure standard for browser-local analysis products

This is an internal authoring checklist. It is not a substitute for product-specific legal review.

## 1. Never promise more privacy than the implementation provides

For each product, verify and separately disclose:

- which user files or records are processed only in the browser/local runtime;
- whether any file content is uploaded to an application API;
- what derived values are stored locally;
- what account, identity, payment, entitlement, support, security, and technical-log data are processed server-side;
- which third-party providers process those categories;
- whether cloud sync, backup, sharing, AI processing, telemetry, or support uploads exist.

Do not use blanket wording such as “no data is sent to servers” when authentication, billing, telemetry, logs, or other network processing still occurs.

## 2. Explain the user-protection purpose of local processing

When true, state that browser/local processing is deliberately used to reduce unnecessary centralized collection of business or analysis data. Also state the boundary: local processing does not remove risks from the user’s device, browser extensions, operating-system sync, backups, or network metadata.

## 3. Data rights and input responsibility

Disclose that the user must have authority to use uploaded/imported data. The application may validate format and statistical properties, but cannot guarantee:

- authenticity;
- completeness;
- legal authority to use third-party data;
- economic/statistical appropriateness;
- absence of omitted variables;
- causal interpretation.

## 4. Model disclosures

For analytical products, identify:

- what the model estimates;
- what it does not estimate;
- main assumptions;
- minimum-data/HOLD conditions;
- extrapolation controls;
- difference between descriptive fit, causal inference, equilibrium, forecast, and optimization;
- any distributional assumptions actually used.

Do not describe a fitted equilibrium as a “correct” or “optimal” price unless the product separately models an explicit objective and satisfies the required data conditions.

## 5. Liability wording

Do not write a blanket “we are never liable” clause.

Prefer:
- output is decision support and not a guarantee of business results;
- the user must review inputs, assumptions, warnings, and outputs before acting;
- product-specific omitted factors are listed;
- liability that cannot legally be excluded or limited remains governed by applicable law.

## 6. Billing and commerce

Before purchase, clearly disclose:
- plan name and price;
- billing frequency and automatic renewal;
- service start;
- cancellation method and effective timing;
- refund policy and legal exceptions;
- plan-switching limitations and duplicate-subscription risk where applicable;
- required operating environment;
- material service/model limitations.

## 7. Privacy

State purposes for identity, payment, security, and support data. Explain retention at a useful level without inventing exact periods when provider or legal retention is variable. Distinguish browser-local data from provider-generated technical logs.

## 8. Product-specific review before reuse

This standard can be reused, but claims such as “files are never uploaded” must be verified against each repository before publication. A privacy-preserving architecture in one product must not be copied as a factual statement into another product unless its implementation supports the same claim.
