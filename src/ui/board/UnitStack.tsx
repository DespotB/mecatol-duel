import { ownerKey, spriteUrl } from '../art'
import { spriteSize } from '../sprites'
import { useModelStyle } from '../modelStyle'
import type { Color, Owner, UnitType } from '../../engine/types'

export interface UnitGroup { owner: Owner; type: UnitType; count: number }

const ORDER: UnitType[] = ['flagship', 'warsun', 'dreadnought', 'carrier', 'cruiser', 'destroyer', 'fighter', 'infantry', 'spacedock', 'pds']

/** Groups units by owner and type in a stable order, so the board never reshuffles between renders. */
export function groupUnits(units: { owner: Owner; type: UnitType }[]): UnitGroup[] {
  const counts = new Map<string, UnitGroup>()
  for (const unit of units) {
    const key = `${ownerKey(unit.owner)}:${unit.type}`
    const found = counts.get(key)
    if (found) found.count += 1
    else counts.set(key, { owner: unit.owner, type: unit.type, count: 1 })
  }
  return [...counts.values()].sort((a, b) => {
    const owners = ownerKey(a.owner).localeCompare(ownerKey(b.owner))
    return owners !== 0 ? owners : ORDER.indexOf(a.type) - ORDER.indexOf(b.type)
  })
}

export interface UnitStackProps {
  group: UnitGroup
  colour: Color | 'grey'
  testId: string
  scale?: number
  /** Ground forces always carry their count (a lone infantry still matters); fleet stacks only badge duplicates. */
  alwaysCount?: boolean
}

export function UnitStack({ group, colour, testId, scale, alwaysCount = false }: UnitStackProps) {
  const { style } = useModelStyle()
  const size = spriteSize(group.type, scale, style)
  return (
    <span className="stk" data-testid={`stack-${testId}`}>
      <img
        src={spriteUrl(colour, group.type, style)} alt={group.type}
        width={size.width} height={size.height} data-testid={`sprite-${testId}`}
      />
      {group.count > 1 || alwaysCount ? <span className="cnt">{group.count}</span> : null}
    </span>
  )
}
