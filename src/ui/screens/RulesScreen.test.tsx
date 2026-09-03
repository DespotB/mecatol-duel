// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../App'
import { PUBLIC_OBJECTIVES } from '../../data/objectives'
import { POST_IDS, POSTS } from '../../data/posts'

function renderApp(hash: string) {
  window.location.hash = hash
  return render(<App ticking={false} />)
}

describe('the rules page', () => {
  it('is reachable straight from its own URL and carries the five sections', () => {
    renderApp('#/rules')
    expect(screen.getByTestId('rules-screen')).toBeTruthy()
    expect(screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent)).toEqual([
      'The short version',
      'What is different from Twilight Imperium',
      'Trade posts',
      'Victory points',
      'The clock',
    ])
  })

  it('names all six posts with their picture and ability, and says every game rolls two', () => {
    const { container } = renderApp('#/rules')
    const text = container.textContent ?? ''
    expect(text).toContain('two of them')
    for (const id of POST_IDS) {
      const post = POSTS[id]
      expect(text).toContain(post.name)
      expect(text).toContain(post.abilityText)
      expect(screen.getByAltText(post.name).getAttribute('src')).toBe(post.art)
    }
  })

  it('points the old trade post bullet at the new section', () => {
    renderApp('#/rules')
    const group = screen.getByText('Trade posts', { selector: '.lbl' }).closest('.grp')
    expect(group?.textContent).toContain('below')
  })

  it('names the six public objectives the engine reveals, in their order', () => {
    const { container } = renderApp('#/rules')
    const text = container.textContent ?? ''
    let at = -1
    for (const objective of PUBLIC_OBJECTIVES) {
      const found = text.indexOf(objective.text)
      expect(found).toBeGreaterThan(at)
      at = found
    }
  })

  it('says that the clock never takes the game away', () => {
    const { container } = renderApp('#/rules')
    expect(container.textContent).toContain('Running out of time does not lose you the game.')
  })

  it('goes back to the lobby', () => {
    renderApp('#/rules')
    fireEvent.click(screen.getByTestId('btn-back-to-lobby'))
    expect(window.location.hash).toBe('#/')
    expect(screen.getByTestId('setup-screen')).toBeTruthy()
  })

  it('opens from the lobby', () => {
    renderApp('#/')
    fireEvent.click(screen.getByTestId('btn-rules'))
    expect(window.location.hash).toBe('#/rules')
    expect(screen.getByTestId('rules-screen')).toBeTruthy()
  })
})
