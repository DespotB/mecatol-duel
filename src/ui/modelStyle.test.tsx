// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { MODEL_STYLES, ModelStyleProvider, useModelStyle } from './modelStyle'
import { spriteUrl } from './art'

function Probe() {
  const { style, setStyle } = useModelStyle()
  return (
    <>
      <img data-testid="ship" src={spriteUrl('blue', 'dreadnought', style)} alt="" />
      {MODEL_STYLES.map(s => (
        <button key={s.id} type="button" data-testid={`pick-${s.id}`} onClick={() => { setStyle(s.id) }}>{s.name}</button>
      ))}
    </>
  )
}

describe('the model style is the viewer\'s own setting', () => {
  beforeEach(() => { window.localStorage.clear() })

  it('starts on the miniatures and switches the art of every unit', () => {
    render(<ModelStyleProvider><Probe /></ModelStyleProvider>)
    expect(screen.getByTestId('ship').getAttribute('src')).toBe('/assets/sprites/blue_dreadnought.png')
    fireEvent.click(screen.getByTestId('pick-topdown'))
    expect(screen.getByTestId('ship').getAttribute('src')).toBe('/assets/sprites/topdown/blue_dreadnought.png')
    fireEvent.click(screen.getByTestId('pick-counters'))
    expect(screen.getByTestId('ship').getAttribute('src')).toBe('/assets/sprites/counters/blue_dreadnought.png')
  })

  it('remembers the choice in this browser and follows another tab', () => {
    const first = render(<ModelStyleProvider><Probe /></ModelStyleProvider>)
    fireEvent.click(screen.getByTestId('pick-topdown'))
    expect(window.localStorage.getItem('md:style')).toBe('topdown')
    first.unmount()
    render(<ModelStyleProvider><Probe /></ModelStyleProvider>)
    expect(screen.getByTestId('ship').getAttribute('src')).toContain('/topdown/')
    act(() => {
      window.localStorage.setItem('md:style', 'counters')
      window.dispatchEvent(new StorageEvent('storage', { key: 'md:style' }))
    })
    expect(screen.getByTestId('ship').getAttribute('src')).toContain('/counters/')
  })

  it('ignores a stored value it does not know', () => {
    window.localStorage.setItem('md:style', 'holograms')
    render(<ModelStyleProvider><Probe /></ModelStyleProvider>)
    expect(screen.getByTestId('ship').getAttribute('src')).toBe('/assets/sprites/blue_dreadnought.png')
  })
})
