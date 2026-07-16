import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { neonMock, configState, exitSpy } = vi.hoisted(() => ({
  neonMock: vi.fn(),
  configState: { DATABASE_URL: 'postgresql://ep-example.neon.tech/oma' },
  exitSpy: vi.fn(),
}))

vi.mock('@neondatabase/serverless', () => ({
  neon: neonMock,
}))

vi.mock('../config.js', () => ({
  get config() {
    return configState
  },
}))

vi.mock('../lib/logger.js', () => ({
  logger: {
    fatal: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}))

const loadFresh = async () => {
  exitSpy.mockReset()
  vi.resetModules()
  neonMock.mockReset()
  const mod = await import('../db/client.js')
  return mod
}

describe('db/client fail-fast behavior', () => {
  const originalEnv = process.env.NODE_ENV
  const originalExit = process.exit

  beforeEach(() => {
    process.exit = exitSpy as never
    configState.DATABASE_URL = 'postgresql://localhost:5432/oma'
  })

  afterEach(() => {
    process.env.NODE_ENV = originalEnv
    process.exit = originalExit
  })

  it('process.exit(1) when DATABASE_URL is missing in production', async () => {
    process.env.NODE_ENV = 'production'
    configState.DATABASE_URL = ''

    const mod = await loadFresh()
    mod.getDb()

    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('process.exit(1) when DATABASE_URL is missing in development', async () => {
    process.env.NODE_ENV = 'development'
    configState.DATABASE_URL = ''

    const mod = await loadFresh()
    mod.getDb()

    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('process.exit(1) when neon() throws in production', async () => {
    process.env.NODE_ENV = 'production'
    // Must be a Neon host — local Postgres uses the `pg` driver and never calls neon().
    configState.DATABASE_URL = 'postgresql://ep-example.us-east-1.aws.neon.tech/oma'

    const mod = await loadFresh()
    neonMock.mockImplementationOnce(() => {
      throw new Error('connection refused')
    })
    mod.getDb()

    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('throws when DATABASE_URL is missing in test (no exit)', async () => {
    process.env.NODE_ENV = 'test'
    configState.DATABASE_URL = ''

    const mod = await loadFresh()
    expect(() => mod.getDb()).toThrow(/DATABASE_URL is required/)
    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('throws when neon() throws in test (no exit)', async () => {
    process.env.NODE_ENV = 'test'
    configState.DATABASE_URL = 'postgresql://ep-example.us-east-1.aws.neon.tech/oma'

    const mod = await loadFresh()
    neonMock.mockImplementationOnce(() => {
      throw new Error('connection refused')
    })
    expect(() => mod.getDb()).toThrow(/connection refused/)
    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('returns null after a previous init failure in test (no exit)', async () => {
    process.env.NODE_ENV = 'test'
    configState.DATABASE_URL = 'postgresql://ep-example.us-east-1.aws.neon.tech/oma'

    const mod = await loadFresh()
    neonMock.mockImplementationOnce(() => {
      throw new Error('connection refused')
    })
    expect(() => mod.getDb()).toThrow(/connection refused/)
    expect(exitSpy).not.toHaveBeenCalled()

    expect(mod.getDb()).toBeNull()
    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('exports resetDbState function', async () => {
    const mod = await loadFresh()
    expect(typeof mod.resetDbState).toBe('function')
    expect(() => mod.resetDbState()).not.toThrow()
  })
})
