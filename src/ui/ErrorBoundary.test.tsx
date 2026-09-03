// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

function Boom(): never {
  throw new Error('the engine exploded')
}

describe('the error boundary', () => {
  it('shows the error and the escape hatch instead of a blank page', () => {
    // React re-throws into console.error on its way through the boundary; that noise is expected here
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    expect(screen.getByTestId('error-boundary')).toBeTruthy()
    expect(screen.getByTestId('error-message').textContent).toBe('the engine exploded')
    expect(screen.getByTestId('btn-clear-session').textContent).toBe('Clear the saved game and restart')
    quiet.mockRestore()
  })

  it('renders its children while nothing throws', () => {
    render(<ErrorBoundary><span data-testid="child">fine</span></ErrorBoundary>)
    expect(screen.getByTestId('child').textContent).toBe('fine')
    expect(screen.queryByTestId('error-boundary')).toBeNull()
  })
})
