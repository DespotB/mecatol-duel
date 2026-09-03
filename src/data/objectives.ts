export interface ObjectiveDef { id: string; text: string; round: number }

export const PUBLIC_OBJECTIVES: ObjectiveDef[] = [
  { id: 'own_3_techs', text: 'Own 3 technologies', round: 1 },
  { id: 'control_4_outside_home', text: 'Control 4 planets outside your home system', round: 2 },
  { id: 'three_ships_mecatol', text: 'Have 3 or more non-fighter ships in the Mecatol Rex system', round: 3 },
  { id: 'spend_6_production', text: 'Spend 6 resources in a single production', round: 4 },
  { id: 'control_5_planets', text: 'Control 5 planets', round: 5 },
  { id: 'two_techs_same_colour', text: 'Own 2 technologies of the same colour', round: 6 },
]

export const MANDATE = { id: 'first_strike' as const, text: 'First Strike: win a space combat in the Mecatol Rex system or in the enemy home system' }
