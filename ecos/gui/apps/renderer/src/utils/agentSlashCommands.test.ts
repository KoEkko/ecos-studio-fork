import { describe, expect, it } from 'vitest'
import {
  filterSlashSuggestions,
  parseSlashCommand,
} from './agentSlashCommands'

const STEPS = ['Synthesis', 'Floorplan', 'Route', 'DRC']

describe('parseSlashCommand', () => {
  it('returns null for ordinary chat text', () => {
    expect(parseSlashCommand('run the flow', STEPS)).toBeNull()
    expect(parseSlashCommand('  why did route fail', STEPS)).toBeNull()
  })

  it('parses full-flow run and rerun', () => {
    expect(parseSlashCommand('/run', STEPS)).toEqual({
      kind: 'run',
      rerun: false,
    })
    expect(parseSlashCommand('/rerun', STEPS)).toEqual({
      kind: 'run',
      rerun: true,
    })
  })

  it('matches step names case-insensitively', () => {
    expect(parseSlashCommand('/run route', STEPS)).toEqual({
      kind: 'run',
      rerun: false,
      step: 'Route',
    })
    expect(parseSlashCommand('/log DRC', STEPS)).toEqual({
      kind: 'log',
      step: 'DRC',
    })
  })

  it('keeps an unmatched step token so the caller can reject it', () => {
    expect(parseSlashCommand('/run mystery', STEPS)).toEqual({
      kind: 'run',
      rerun: false,
      step: 'mystery',
    })
  })

  it('parses panel and clear commands', () => {
    expect(parseSlashCommand('/qor', STEPS)).toEqual({ kind: 'qor' })
    expect(parseSlashCommand('/clear', STEPS)).toEqual({ kind: 'clear' })
  })

  it('marks unknown slash input instead of treating it as chat', () => {
    expect(parseSlashCommand('/help', STEPS)).toEqual({
      kind: 'unknown',
      input: '/help',
    })
    expect(parseSlashCommand('/log', STEPS)).toEqual({
      kind: 'unknown',
      input: '/log',
    })
  })
})

describe('filterSlashSuggestions', () => {
  it('filters by the leading command token', () => {
    expect(filterSlashSuggestions('/r').map((item) => item.command)).toEqual([
      '/run',
      '/rerun',
      '/run <step>',
    ])
  })

  it('returns nothing when the box is not starting a command', () => {
    expect(filterSlashSuggestions('run')).toEqual([])
  })
})
