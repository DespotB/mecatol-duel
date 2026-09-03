/** `short` is what the board prints; the full `text` belongs in the card that opens on hover. */
export interface ObjectiveDef { id: string; text: string; short: string; round: number }

export const PUBLIC_OBJECTIVES: ObjectiveDef[] = [
  { id: 'own_3_techs', text: 'Own 3 technologies', short: '3 technologies', round: 1 },
  { id: 'control_4_outside_home', text: 'Control 4 planets outside your home system', short: '4 planets abroad', round: 2 },
  { id: 'three_ships_mecatol', text: 'Have 3 or more non-fighter ships in the Mecatol Rex system', short: '3 ships at Rex', round: 3 },
  { id: 'spend_6_production', text: 'Spend 6 resources in a single production', short: '6 resources at once', round: 4 },
  { id: 'control_5_planets', text: 'Control 5 planets', short: '5 planets', round: 5 },
  { id: 'two_techs_same_colour', text: 'Own 2 technologies of the same colour', short: '2 of one colour', round: 6 },
]

export const MANDATE = {
  id: 'first_strike' as const,
  short: 'First Strike',
  text: 'First Strike: win a space combat in the Mecatol Rex system or in the enemy home system',
}
