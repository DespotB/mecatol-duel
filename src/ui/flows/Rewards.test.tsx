// src/ui/flows/Rewards.test.tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Rewards } from './Rewards'

describe('Rewards', () => {
  it('renders the count badge and the icon alt for a count above one', () => {
    render(<Rewards items={[{ icon: '/tg.png', alt: 'Trade good', count: 3, label: 'Trade goods' }]} />)
    const row = screen.getByTestId('reward-0')
    expect(row.textContent).toContain('3')
    expect(screen.getByAltText('Trade good')).toBeTruthy()
  })

  it('renders no count badge when count is exactly one', () => {
    render(<Rewards items={[{ icon: '/ct.png', alt: 'Command token', count: 1, label: 'Command token' }]} />)
    const row = screen.getByTestId('reward-0')
    expect(row.querySelector('.n')).toBeNull()
  })

  it('drops an item whose count is 0, keeping the others', () => {
    render(<Rewards items={[
      { icon: '/tg.png', alt: 'Trade good', count: 3, label: 'Trade goods' },
      { icon: '/cm.png', alt: 'Commodity', count: 0, label: 'Commodities' },
    ]} />)
    expect(screen.queryByAltText('Commodity')).toBeNull()
    expect(screen.getByAltText('Trade good')).toBeTruthy()
  })

  it('renders nothing for an empty item list', () => {
    const { container } = render(<Rewards items={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the note as a sub line above the row when present', () => {
    render(<Rewards items={[{ icon: '/tg.png', alt: 'Trade good', count: 2, label: 'Trade goods' }]} note="Costs you 1 strategy token" />)
    expect(screen.getByText('Costs you 1 strategy token')).toBeTruthy()
    expect(screen.getByTestId('rewards')).toBeTruthy()
  })
})
