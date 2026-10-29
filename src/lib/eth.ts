const DECIMALS = 18

// "0.45" -> 450000000000000000n, evita erro de ponto flutuante
export function toUnits(value: string): bigint {
  const [whole, frac = ''] = value.split('.')
  return BigInt(whole + frac.padEnd(DECIMALS, '0').slice(0, DECIMALS))
}

export function fromUnits(units: bigint): string {
  const text = units.toString().padStart(DECIMALS + 1, '0')
  const whole = text.slice(0, -DECIMALS)
  const frac = text.slice(-DECIMALS).replace(/0+$/, '')
  return frac ? `${whole}.${frac}` : whole
}

export function formatEth(value: string): string {
  const [whole, frac = ''] = value.split('.')
  return `${whole}.${frac.replace(/0+$/, '').padEnd(2, '0')} ETH`
}
