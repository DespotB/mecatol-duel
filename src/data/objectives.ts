/**
 * R7: what scoring an objective costs on top of fulfilling it. `resources` is paid out of ready planets and
 * trade goods at the moment of scoring, which the engine settles itself. `time` is a fraction of the clock the
 * seat has left, and the engine is time-free: it grants the point and the client that owns the clock takes the
 * time (`src/ui/store.tsx`). An objective without a cost scores itself in the status phase.
 */
export type ObjectiveCost = { kind: 'resources'; amount: number } | { kind: 'time'; fraction: number }

/**
 * R7: the public objectives are a pool the game draws six from at setup and reveals one at a time, so no two
 * games run the same race. `short` is what the board prints, the full `text` belongs in the card that opens on
 * hover. The mandates are not part of the pool: First Strike is a race both players run for the same single
 * point, Foothold is the secret each of them starts with.
 */
export interface ObjectiveDef { id: string; text: string; short: string; cost?: ObjectiveCost }

export const PUBLIC_OBJECTIVES: ObjectiveDef[] = [
  { id: 'win_space_combat', text: 'Win a space combat against your opponent', short: 'Win a space fight' },
  { id: 'control_4_outside_home', text: 'Control 4 planets outside your home system', short: '4 planets abroad' },
  { id: 'pay_6_resources', text: 'Pay 6 resources when you score this', short: 'Pay 6 resources', cost: { kind: 'resources', amount: 6 } },
  { id: 'trade_three_times', text: 'Trade three times, at the trade posts or with your opponent', short: '3 trades' },
  { id: 'more_ships', text: 'Have more ships on the board than your opponent', short: 'More ships' },
  { id: 'own_5_techs', text: 'Own 5 technologies', short: '5 technologies' },
  { id: 'pay_time_20', text: 'Pay a fifth of the time left on your clock', short: 'A fifth of your time', cost: { kind: 'time', fraction: 0.2 } },
]

export const FIRST_STRIKE: ObjectiveDef = {
  id: 'first_strike',
  short: 'First Strike',
  text: 'First Strike: be the first to win a space combat in the Mecatol Rex system',
}

export const FOOTHOLD: ObjectiveDef = {
  id: 'foothold',
  short: 'Foothold',
  text: 'Foothold: take a planet in your opponent’s home system',
}

/** The two cards outside the pool: the race, then the secret every player starts with. */
export const MANDATES: ObjectiveDef[] = [FIRST_STRIKE, FOOTHOLD]
export const MANDATE_IDS: readonly string[] = MANDATES.map(m => m.id)

export function objectiveDef(id: string): ObjectiveDef | undefined {
  return PUBLIC_OBJECTIVES.find(o => o.id === id) ?? MANDATES.find(m => m.id === id)
}

/** R7: what the objective costs to score, if anything. An unknown id has no cost, never a throw. */
export function objectiveCost(id: string): ObjectiveCost | undefined {
  return objectiveDef(id)?.cost
}

/** R7: a paid objective is never scored automatically; the player has to ask for it and cover the cost. */
export function isPaidObjective(id: string): boolean {
  return objectiveCost(id) !== undefined
}
