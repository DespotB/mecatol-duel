export function deepFreeze<T>(value: T): T {
  if (value !== null && (typeof value === 'object' || Array.isArray(value)) && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const v of Object.values(value)) deepFreeze(v)
  }
  return value
}
