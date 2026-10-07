export interface TokenRates {
  inputPer1M: number;
  outputPer1M: number;
}

export interface PricingWithCosts extends TokenRates {
  markup: number;
  extended?: TokenRates & { threshold: number };
  /** Estimated provider rates, independent of final customer overrides. */
  upstream?: TokenRates & { extended?: TokenRates & { threshold: number } };
}

function ratesFor<T extends TokenRates & { extended?: TokenRates & { threshold: number } }>(rates: T, input: number): TokenRates {
  return rates.extended && input > rates.extended.threshold ? rates.extended : rates;
}

export function calculateUsageCosts(pricing: PricingWithCosts, promptTokens: number, outputTokens: number) {
  const retail = ratesFor(pricing, promptTokens);
  const upstream = ratesFor(pricing.upstream ?? pricing, promptTokens);
  const cost = (rates: TokenRates) => (promptTokens * rates.inputPer1M + outputTokens * rates.outputPer1M) / 10_000;
  const upstreamCostCents = cost(upstream);
  const userCostCents = cost(retail) * (1 + pricing.markup / 100);
  return { upstreamCostCents, userCostCents, markupCents: userCostCents - upstreamCostCents };
}
