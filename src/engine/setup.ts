import { FACTIONS } from '../data/factions'
import { MECATOL_ID, SYSTEMS } from '../data/map'
import { PUBLIC_OBJECTIVES } from '../data/objectives'
import { mulberry32 } from './rng'
import type { GameConfig, GameState, Owner, Planet, Player, Seat, StrategyCardId, System, Unit, UnitType } from './types'

export const START_TOKENS = { tactic: 3, fleet: 3, strategy: 2 }
export const ALL_STRATEGY_CARDS: StrategyCardId[] = ['leadership', 'diplomacy', 'trade', 'warfare', 'technology', 'imperial']
export const REINFORCEMENTS: Readonly<Record<UnitType, number>> = { infantry: 12, fighter: 10, destroyer: 8, cruiser: 8, carrier: 4, dreadnought: 5, warsun: 2, flagship: 1, pds: 6, spacedock: 3 }

export const GUARDIAN_FLEETS: readonly Partial<Record<UnitType, number>>[] = [
  { dreadnought: 1, cruiser: 1, destroyer: 1, fighter: 2 },
  { dreadnought: 2 },
  { carrier: 1, cruiser: 1, destroyer: 2, fighter: 2 },
  { dreadnought: 1, cruiser: 2 },
  { cruiser: 2, destroyer: 2, fighter: 4 },
  { carrier: 1, dreadnought: 1, fighter: 2 },
]

function makeUnit(counter: { nextUnitId: number }, type: UnitType, owner: Owner): Unit {
  return { id: counter.nextUnitId++, type, owner, damaged: false }
}

function makePlayer(seat: Seat, cfg: GameConfig['players'][number]): Player {
  const f = FACTIONS[cfg.faction]
  const reinforcements = { ...REINFORCEMENTS }
  for (const su of f.startingUnits) reinforcements[su.type] -= su.count
  return {
    seat, faction: cfg.faction, color: cfg.color, name: cfg.name, vp: 0,
    tokens: { ...START_TOKENS }, tradeGoods: 0, commodities: f.commodityValue,
    techs: [...f.startingTechs], strategyCards: [], passed: false,
    scoredObjectives: [], mandateScored: false, mandateEarnedThisRound: false,
    spentInOneProductionThisRound: 0, tradedThisRound: { west: false, east: false },
    inheritanceExhausted: false, shipyardUsed: false, reinforcements,
  }
}

export function createGame(config: GameConfig, seed: number): GameState {
  const counter = { nextUnitId: 1 }
  const systems: Record<string, System> = {}
  for (const def of SYSTEMS) {
    const planets: Planet[] = def.planets.map(p => ({ id: p.id, name: p.name, resources: p.resources, influence: p.influence, owner: def.home, exhausted: false, ground: [], structures: [] }))
    systems[def.id] = { id: def.id, name: def.name, planets, anomaly: def.anomaly, wormhole: def.wormhole, space: [], activatedBy: [] }
  }
  for (const seat of [0, 1] as Seat[]) {
    const home = SYSTEMS.find(s => s.home === seat)
    if (!home) throw new Error('missing home system')
    const sys = systems[home.id]
    for (const su of FACTIONS[config.players[seat].faction].startingUnits) {
      for (let i = 0; i < su.count; i++) {
        const unit = makeUnit(counter, su.type, seat)
        if (!su.planetId) { sys.space.push(unit); continue }
        const planet = sys.planets.find(p => p.id === su.planetId)
        if (!planet) throw new Error(`unknown planet ${su.planetId}`)
        if (su.type === 'infantry') planet.ground.push(unit); else planet.structures.push(unit)
      }
    }
  }
  const other: Seat = config.speaker === 0 ? 1 : 0
  const state: GameState = {
    version: 1, round: 1, phase: 'strategy', speaker: config.speaker, active: config.speaker,
    strategyPool: ALL_STRATEGY_CARDS.map(id => ({ id, bonus: 0 })),
    draft: [config.speaker, other, other, config.speaker],
    publicObjectives: [PUBLIC_OBJECTIVES[0].id],
    players: [makePlayer(0, config.players[0]), makePlayer(1, config.players[1])],
    systems, tactical: null, pendingSecondary: null,
    nextUnitId: counter.nextUnitId, guardianRolls: 0, winner: null, log: [],
  }
  return rollGuardianFleet(state, seed)
}

export function rollGuardianFleet(state: GameState, seed: number): GameState {
  const rng = mulberry32(seed)
  const fleet = GUARDIAN_FLEETS[Math.floor(rng() * GUARDIAN_FLEETS.length)]
  const counter = { nextUnitId: state.nextUnitId }
  const newGuardians: Unit[] = []
  for (const [type, n] of Object.entries(fleet) as [UnitType, number][]) for (let i = 0; i < n; i++) newGuardians.push(makeUnit(counter, type, 'guardian'))
  const mecatol = state.systems[MECATOL_ID]
  const twoNewGuardianInfantry = [makeUnit(counter, 'infantry', 'guardian'), makeUnit(counter, 'infantry', 'guardian')]
  const planets = mecatol.planets.map((p, i) => i === 0
    ? { ...p, ground: [...p.ground.filter(u => u.owner !== 'guardian'), ...twoNewGuardianInfantry] }
    : p)
  return {
    ...state,
    nextUnitId: counter.nextUnitId,
    guardianRolls: state.guardianRolls + 1,
    systems: {
      ...state.systems,
      [MECATOL_ID]: { ...mecatol, space: [...mecatol.space.filter(u => u.owner !== 'guardian'), ...newGuardians], planets },
    },
    log: [...state.log, { t: 'info', text: `Guardian fleet: ${Object.entries(fleet).map(([t, n]) => `${n} ${t}`).join(', ')} and 2 infantry` }],
  }
}

export function unitsOf(state: GameState, owner: Owner): Unit[] {
  const out: Unit[] = []
  for (const sys of Object.values(state.systems)) {
    out.push(...sys.space.filter(u => u.owner === owner))
    for (const p of sys.planets) { out.push(...p.ground.filter(u => u.owner === owner)); out.push(...p.structures.filter(u => u.owner === owner)) }
  }
  return out
}
