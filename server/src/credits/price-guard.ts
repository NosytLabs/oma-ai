import { getOmaPriceChange24h, isOracleFresh, getOmaUsdPrice, isOracleLive } from './oracle.js'

export async function checkCircuitBreaker(): Promise<{ omaBonusPercent: number; omaDepositsAllowed: boolean; reason?: string }> {
  if (!isOracleLive()) {
    return { omaBonusPercent: 0, omaDepositsAllowed: false, reason: 'Oracle not live - OMA deposits disabled' }
  }

  const change24h = await getOmaPriceChange24h()

  if (change24h <= -50) {
    return { omaBonusPercent: 0, omaDepositsAllowed: false, reason: 'OMA price dropped >50% in 24h - deposits halted' }
  }
  if (change24h <= -35) {
    return { omaBonusPercent: 0, omaDepositsAllowed: true, reason: 'OMA price dropped >35% in 24h - bonus suspended' }
  }
  if (change24h <= -20) {
    return { omaBonusPercent: 2, omaDepositsAllowed: true, reason: 'OMA price dropped >20% in 24h - bonus reduced' }
  }
  return { omaBonusPercent: 5, omaDepositsAllowed: true }
}

export async function checkOracleCircuitBreaker(): Promise<boolean> {
  const fresh = await isOracleFresh()
  if (!fresh) return true

  const spot = await getOmaUsdPrice()
  if (spot === 0) return true

  return false
}
