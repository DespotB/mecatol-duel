// `internal` marks an error that came out of a thrown exception rather than a rules rejection: an engine bug,
// never a legal-move question. Callers may treat it as fatal.
export type Result<T> = { ok: true; value: T } | { ok: false; error: string; internal?: boolean }

export type Seat = 0 | 1
export type Owner = Seat | 'guardian'
export type FactionId = 'l1z1x' | 'letnev'
export type Color = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'black' | 'orange' | 'pink'
export type UnitType = 'infantry' | 'fighter' | 'destroyer' | 'cruiser' | 'carrier' | 'dreadnought' | 'warsun' | 'flagship' | 'pds' | 'spacedock'
export type TechColor = 'blue' | 'red' | 'green' | 'yellow'
export type StrategyCardId = 'leadership' | 'diplomacy' | 'trade' | 'warfare' | 'technology' | 'imperial'
export type Phase = 'strategy' | 'action' | 'status' | 'ended'

export interface Unit { id: number; type: UnitType; owner: Owner; damaged: boolean }
export interface Planet {
  id: string; name: string; resources: number; influence: number
  owner: Seat | null; exhausted: boolean
  ground: Unit[]        // infantry
  structures: Unit[]    // spacedock, pds
}
export interface System {
  id: string; name: string
  planets: Planet[]
  anomaly: 'asteroid' | 'nebula' | null
  wormhole: 'alpha' | 'beta' | null
  // ships, plus fighters and infantry being transported; NON_FIGHTER_SHIPS and isShip exclude infantry, so capacity and fleet-pool helpers work on this mixed array
  space: Unit[]                    // ships
  activatedBy: Seat[]              // command tokens on the system this round
}
export interface Player {
  seat: Seat; faction: FactionId; color: Color; name: string
  vp: number
  tokens: { tactic: number; fleet: number; strategy: number }
  tradeGoods: number; commodities: number
  techs: string[]                  // tech ids from data/techs.ts
  strategyCards: { id: StrategyCardId; used: boolean }[]
  passed: boolean
  scoredObjectives: string[]; mandateScored: boolean; mandateEarnedThisRound: boolean
  spentInOneProductionThisRound: number
  tradedThisRound: { west: boolean; east: boolean }
  inheritanceExhausted: boolean; shipyardUsed: boolean
  pendingInfantry: number          // R4.3 step 4: Infantry II waiting to return at the start of your next turn
  reinforcements: Record<UnitType, number>
}
export interface TacticalContext {
  systemId: string
  step: 'movement' | 'spaceCombat' | 'invasion' | 'production' | 'done'
  combat?: CombatState
  invasion?: InvasionState
}
export interface CombatState { round: number; attacker: Seat; defender: Owner; retreating: Seat | null; retreatTo: string | null; lastRolls: DieRoll[] }
export interface InvasionState { planetId: string | null; landed: number[]; bombarded: string[]; round: number }
export interface DieRoll { owner: Owner; unit: UnitType; value: number; hit: boolean }
export interface GameState {
  version: 1
  round: number; phase: Phase
  speaker: Seat; active: Seat
  strategyPool: { id: StrategyCardId; bonus: number }[]   // unpicked cards with trade goods
  draft: Seat[]                                          // remaining pick order in the strategy phase
  publicObjectives: string[]                             // revealed ids
  players: [Player, Player]
  systems: Record<string, System>
  tactical: TacticalContext | null
  pendingSecondary: StrategyCardId | null                // opponent may respond
  nextUnitId: number
  guardianRolls: number
  winner: Seat | null
  log: LogEntry[]
}
export type LogEntry = { t: 'move'; seat: Seat | null; move: Move } | { t: 'roll'; owner: Owner; rolls: DieRoll[]; context: string } | { t: 'info'; text: string }

export type Move =
  | { type: 'pickStrategyCard'; card: StrategyCardId }
  | { type: 'startTactical'; systemId: string }
  | { type: 'moveShips'; moves: { unitId: number; from: string; carrying: number[] }[] }   // all into tactical.systemId
  | { type: 'endMovement' }
  | { type: 'combatRound'; munitions?: { attacker?: boolean; defender?: boolean } }   // resolves one round (or the pre-combat steps on round 0); Munitions Reserves is per side
  | { type: 'retreat'; to: string }
  | { type: 'bombard'; planetId: string }
  | { type: 'land'; planetId: string; infantryIds: number[] }
  | { type: 'groundCombatRound' }
  | { type: 'endInvasion' }
  | { type: 'produce'; units: Partial<Record<UnitType, number>>; planets: string[]; tradeGoods: number }
  | { type: 'endTactical' }
  | { type: 'strategic'; card: StrategyCardId; params?: StrategicParams }
  | { type: 'secondary'; card: StrategyCardId; accept: boolean; params?: StrategicParams }
  | { type: 'research'; techId: string; via: 'technology' | 'technologySecond' | 'inheritance' }
  | { type: 'shipyard'; planetId: string; planets: string[]; tradeGoods: number }
  | { type: 'tradePost'; post: 'west' | 'east'; commodities: number }
  | { type: 'pass' }
  | { type: 'status'; params: StatusParams }             // one move per player: token distribution, then the engine finishes the phase when both are in
export interface StrategicParams { systemId?: string; planets?: string[]; techId?: string; secondTechId?: string; tradeGoods?: number; units?: Partial<Record<UnitType, number>> }
export interface StatusParams { tokens: { tactic: number; fleet: number; strategy: number } }

export interface UnitStats {
  cost: number; producedPerCost: number
  combat: number | null; combatDice: number
  move: number; capacity: number; sustain: boolean
  bombardment: { value: number; dice: number } | null
  afb: { value: number; dice: number } | null
  spaceCannon: { value: number; dice: number } | null
  planetaryShield: boolean
  production: number | null
}
export interface GameConfig {
  players: [{ faction: FactionId; color: Color; name: string }, { faction: FactionId; color: Color; name: string }]
  speaker: Seat
}
