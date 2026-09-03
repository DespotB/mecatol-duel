/**
 * R7: the public objectives are a pool the game shuffles at setup and reveals one at a time, so no two games
 * run the same race. `short` is what the board prints, the full `text` belongs in the card that opens on
 * hover. The mandates are not part of the pool: First Strike is a race both players run for the same single
 * point, Foothold is the secret each of them starts with.
 */
export interface ObjectiveDef { id: string; text: string; short: string }

export const PUBLIC_OBJECTIVES: ObjectiveDef[] = [
  { id: 'win_space_combat', text: 'Win a space combat against your opponent', short: 'Win a space fight' },
  { id: 'control_4_outside_home', text: 'Control 4 planets outside your home system', short: '4 planets abroad' },
  { id: 'spend_6_resources', text: 'Spend 6 resources in a single round', short: '6 resources in a round' },
  { id: 'trade_three_times', text: 'Trade three times, at the trade posts or with your opponent', short: '3 trades' },
  { id: 'more_ships', text: 'Have more ships on the board than your opponent', short: 'More ships' },
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
