import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { clearSession } from './persist'

interface ErrorBoundaryState { error: Error | null }

/**
 * A crash in a screen must not leave the two players staring at a blank page. The boundary shows what
 * broke and offers the one repair that always works: drop the persisted session and reload, because a
 * saved game from an older build is the likeliest way to get stuck in a crash loop.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('the hot-seat client crashed', error, info.componentStack)
  }

  render(): ReactNode {
    const { error } = this.state
    if (error === null) return this.props.children
    return (
      <div className="crash" data-testid="error-boundary">
        <div className="space"><div className="stars" /><div className="neb" /><div className="limb" /><div className="dust" /></div>
        <div className="crashbox cut">
          <div className="in">
            <h1 className="title goldtext">Something broke</h1>
            <p className="crashmsg" data-testid="error-message">{error.message}</p>
            <button
              type="button" className="btn gold" data-testid="btn-clear-session"
              onClick={() => { clearSession(); window.location.reload() }}
            >
              Clear the saved game and restart
            </button>
          </div>
        </div>
      </div>
    )
  }
}
