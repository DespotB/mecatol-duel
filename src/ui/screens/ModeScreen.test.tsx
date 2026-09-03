// src/ui/screens/ModeScreen.test.tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ModeScreen } from './ModeScreen'
import type { Seat } from '../../engine/types'

const NAMES: [string, string] = ['Despot', 'Kael']

function show(free: Seat[]) {
  const onClaim = vi.fn()
  render(<ModeScreen code="K7X2QP" names={NAMES} free={free} onClaim={onClaim} />)
  return onClaim
}

describe('the mode question', () => {
  it('asks the one question that matters, and names the game', () => {
    show([0, 1])
    const screenText = screen.getByTestId('mode-question').textContent ?? ''
    expect(screenText).toContain('K7X2QP')
    expect(screenText).toContain('Despot')
    expect(screenText).toContain('Kael')
    expect(screen.getByTestId('btn-mode-hotseat')).toBeTruthy()
    expect(screen.getByTestId('btn-take-seat-0')).toBeTruthy()
    expect(screen.getByTestId('btn-take-seat-1')).toBeTruthy()
  })

  it('claims both seats for a device that plays them both', () => {
    const onClaim = show([0, 1])
    fireEvent.click(screen.getByTestId('btn-mode-hotseat'))
    expect(onClaim).toHaveBeenCalledWith([0, 1])
  })

  it('claims one seat for a browser that sends the link on', () => {
    const onClaim = show([0, 1])
    fireEvent.click(screen.getByTestId('btn-take-seat-1'))
    expect(onClaim).toHaveBeenCalledWith([1])
  })

  it('shows the seat another browser holds as taken and offers the free one', () => {
    show([1])
    expect(screen.getByTestId('btn-take-seat-0').hasAttribute('disabled')).toBe(true)
    expect(screen.getByTestId('btn-take-seat-0').textContent).toContain('taken')
    expect(screen.getByTestId('btn-take-seat-1').hasAttribute('disabled')).toBe(false)
    // playing both seats is not on offer once one of them belongs to someone else
    expect(screen.getByTestId('btn-mode-hotseat').hasAttribute('disabled')).toBe(true)
    expect(screen.queryByTestId('btn-watch')).toBeNull()
  })

  it('leaves a visitor to a full game watching, with an empty claim', () => {
    const onClaim = show([])
    expect(screen.getByTestId('btn-take-seat-0').hasAttribute('disabled')).toBe(true)
    expect(screen.getByTestId('btn-take-seat-1').hasAttribute('disabled')).toBe(true)
    fireEvent.click(screen.getByTestId('btn-watch'))
    expect(onClaim).toHaveBeenCalledWith([])
  })
})
