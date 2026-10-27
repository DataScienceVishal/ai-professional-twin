import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LayerSwitch } from './layer-switch'

describe('LayerSwitch', () => {
  it('shows the three layers with the current one pressed', () => {
    render(<LayerSwitch mode="default" onChange={() => {}} />)
    const group = screen.getByRole('group', { name: 'Layer' })
    expect(within(group).getByRole('button', { name: 'General' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(group).getByRole('button', { name: 'Recruiter' })).toHaveAttribute('aria-pressed', 'false')
    expect(within(group).getByRole('button', { name: 'Interview' })).toHaveAttribute('aria-pressed', 'false')
    for (const button of within(group).getAllByRole('button')) {
      // Forced colours drop the pressed fill, so the underline has to mark the layer.
      expect(button).toHaveClass('forced-colors:aria-pressed:underline')
    }
  })

  it('reports the layer that was chosen', () => {
    const onChange = vi.fn()
    render(<LayerSwitch mode="default" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Recruiter' }))
    expect(onChange).toHaveBeenCalledWith('recruiter')
  })

  it('presses whichever layer is current', () => {
    render(<LayerSwitch mode="interview" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Interview' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'General' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Recruiter' })).toHaveAttribute('aria-pressed', 'false')
  })
})
