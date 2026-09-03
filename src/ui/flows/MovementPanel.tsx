import { useState } from 'react'
import { unitStats } from '../../data/units'
import { movableShips } from '../../engine'
import { systemLabel, unitLabel } from '../format'
import { Stepper } from './Stepper'
import { useGame } from '../store'
import type { GameState, Seat, Unit } from '../../engine/types'

interface Cargo { fighter: number; infantry: number }

function shipsAt(state: GameState, from: string, ids: number[]): Unit[] {
  return state.systems[from].space.filter(u => ids.includes(u.id))
}

function availableCargo(state: GameState, seat: Seat, from: string): { fighter: Unit[]; infantry: Unit[] } {
  const sys = state.systems[from]
  return {
    fighter: sys.space.filter(u => u.owner === seat && u.type === 'fighter'),
    infantry: [
      ...sys.space.filter(u => u.owner === seat && u.type === 'infantry'),
      ...sys.planets.flatMap(p => p.ground.filter(u => u.owner === seat)),
    ],
  }
}

export function MovementPanel() {
  const { session, legal, apply } = useGame()
  const [picked, setPicked] = useState<number[]>([])
  const [cargo, setCargo] = useState<Record<string, Cargo>>({})
  if (!session) return null
  const state = session.state
  const seat = state.active
  const player = state.players[seat]
  const stats = { faction: player.faction, techs: player.techs }
  const options = movableShips(state, seat)
  const origins = [...new Set(options.map(o => o.from))]
  const capacityOf = (from: string) => shipsAt(state, from, picked).reduce((sum, u) => sum + unitStats(u.type, stats).capacity, 0)
  const cargoOf = (from: string) => cargo[from] ?? { fighter: 0, infantry: 0 }

  function toggle(unitId: number) {
    setPicked(picked.includes(unitId) ? picked.filter(id => id !== unitId) : [...picked, unitId])
  }

  function submit() {
    const used = new Set<number>()
    const moves = origins.flatMap(from => {
      const here = shipsAt(state, from, picked)
      const want = cargoOf(from)
      const pool = availableCargo(state, seat, from)
      const queue = [
        ...pool.fighter.slice(0, want.fighter).map(u => u.id),
        ...pool.infantry.slice(0, want.infantry).map(u => u.id),
      ]
      return here.map(ship => {
        const room = unitStats(ship.type, stats).capacity
        const carrying: number[] = []
        while (carrying.length < room && queue.length > 0) {
          const id = queue.shift()
          if (id !== undefined && !used.has(id)) {
            used.add(id)
            carrying.push(id)
          }
        }
        return { unitId: ship.id, from, carrying }
      })
    })
    if (moves.length === 0) return
    if (apply({ type: 'moveShips', moves })) {
      setPicked([])
      setCargo({})
    }
  }

  return (
    <div className="drawer bottom cut" data-testid="movement-panel">
      <div className="in">
        <div className="dhead">
          <span className="tab">Movement into {systemLabel(state.tactical?.systemId ?? '')}</span>
          <span className="sub">Pick the ships that move, then how much they carry.</span>
          <div className="right">
            <button type="button" className="btn gold" data-testid="btn-move-ships" disabled={picked.length === 0} onClick={submit}>Move ships</button>
            <button type="button" className="btn quiet" data-testid="btn-end-movement"
              disabled={!legal.some(m => m.type === 'endMovement')} onClick={() => apply({ type: 'endMovement' })}>Done moving</button>
          </div>
        </div>
        {origins.length === 0 ? <div className="sub">No ships can reach this system.</div> : null}
        {origins.map(from => {
          const pool = availableCargo(state, seat, from)
          const want = cargoOf(from)
          const room = capacityOf(from)
          return (
            <div className="rowline" key={from} data-testid={`origin-${from}`}>
              <span className="lbl">{systemLabel(from)}</span>
              {options.filter(o => o.from === from).map(option => {
                const ship = state.systems[from].space.find(u => u.id === option.unitId)
                if (!ship) return null
                const label = `${unitLabel(ship.type, player)} from ${systemLabel(from)}`
                return (
                  <label key={option.unitId} className="pay">
                    <input type="checkbox" aria-label={label} checked={picked.includes(option.unitId)} onChange={() => toggle(option.unitId)} />
                    {unitLabel(ship.type, player)}
                  </label>
                )
              })}
              <span className="lbl">Fighters</span>
              <Stepper id={`cargo-${from}-fighter`} value={want.fighter}
                max={Math.min(pool.fighter.length, room - want.infantry)}
                onChange={n => setCargo({ ...cargo, [from]: { ...want, fighter: n } })} />
              <span className="lbl">Infantry</span>
              <Stepper id={`cargo-${from}-infantry`} value={want.infantry}
                max={Math.min(pool.infantry.length, room - want.fighter)}
                onChange={n => setCargo({ ...cargo, [from]: { ...want, infantry: n } })} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
