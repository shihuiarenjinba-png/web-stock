# Microeconomic equilibrium model safety policy

## Purpose

DemandScope may estimate demand response, supply response, and a model-implied equilibrium price/quantity. These outputs are descriptive decision support, not instructions to set a price.

## Terminology

- Demand response: estimated relationship between own price and observed demand, conditional on included variables.
- Supply response: estimated relationship between own price and observed quantity supplied, conditional on included variables.
- Model equilibrium: a price where the fitted demand and supply responses are equal.
- Practical price: the price actually chosen by the business. It may intentionally differ from model equilibrium because of strategy, contracts, branding, market power, loss-leading, capacity, regulation, or omitted variables.

## Required guardrails

1. **Observed-support guard**
   - Never present a model equilibrium outside the observed own-price range as an actionable recommendation.
   - Outside support => `HOLD_EXTRAPOLATION`.
   - It may be displayed only as an extrapolated model value with an explicit warning.

2. **Historical-step guard**
   - Compare the candidate price change with price changes actually observed in the core history.
   - If the candidate move is materially larger than the historical one-step changes, mark it HOLD or high-risk rather than recommending it.
   - The threshold should be derived from the user's own observed price-change distribution, not a universal percentage.

3. **Identification/data-quality guard**
   - HOLD when own-price variation is insufficient.
   - HOLD when demand or supply regressions are singular, unstable, or fail minimum observation requirements.
   - HOLD when added variables create severe multicollinearity.
   - Missing external drivers are disclosed rather than silently synthesized.

4. **Strategic-pricing guard**
   - Do not infer that a persistent gap between actual price and model equilibrium is an error.
   - Loss-leading, penetration pricing, premium branding, cross-subsidy, contractual pricing, market power, and other strategy can make the chosen price rational even when it differs from the fitted equilibrium.
   - The UI must use labels such as `model equilibrium estimate`, not `correct price` or `optimal price`, unless a separate profit-optimization objective is explicitly modeled.

5. **Decision separation**
   - Model equilibrium answers: “where fitted demand and supply intersect.”
   - Profit optimization answers: “which candidate price maximizes the specified expected-profit objective.”
   - These are different questions and must not be merged into one recommendation.

6. **Uncertainty**
   - Do not require the raw price or quantity series themselves to be normally distributed for OLS point estimates.
   - Prefer robust/bootstrapped uncertainty for regression-derived equilibrium when implemented.
   - Normality assumptions used by inventory Monte Carlo must remain separately disclosed and must not be silently transferred to the microeconomic regression model.

## User data contract

Core demand history must contain, in the same file and on the same observation dates:

- date
- price
- units sold

Supply analysis should require a separate supply core with:

- date
- price
- quantity supplied
- unit cost

Optional external variables remain user-supplied and bounded in count. Demand and supply models should not automatically invent or scrape competitor, macroeconomic, or substitute-product variables.

## UI output levels

- READY: within observed support and model diagnostics acceptable.
- CAUTION: estimate is within support but uncertainty/strategic-data limitations are material.
- HOLD: insufficient identification, severe multicollinearity, excessive extrapolation, or unsupported price move.

Even in READY, equilibrium is a model estimate, not an instruction to change price.
