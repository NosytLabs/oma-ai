import { describe, it, expect } from 'vitest'
import { isInferenceError } from '../types.js'

describe('isInferenceError', () => {
  it('returns true for an Error with a numeric status', () => {
    const err = Object.assign(new Error('provider failed'), { status: 502, type: 'connection_error' })
    expect(isInferenceError(err)).toBe(true)
  })

  it('returns false for a plain Error without status', () => {
    expect(isInferenceError(new Error('plain error'))).toBe(false)
  })

  it('returns false for a non-Error object with a status', () => {
    expect(isInferenceError({ status: 500 })).toBe(false)
  })

  it('returns false for null', () => {
    expect(isInferenceError(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isInferenceError(undefined)).toBe(false)
  })

  it('returns false for a string', () => {
    expect(isInferenceError('boom')).toBe(false)
  })

  it('returns false when status is not a number', () => {
    const err = Object.assign(new Error('weird status'), { status: '500' })
    expect(isInferenceError(err)).toBe(false)
  })

  it('includes optional InferenceError fields on true positives', () => {
    const err = Object.assign(new Error('provider error'), {
      status: 429,
      type: 'rate_limit_error',
      code: 'venice_rate_limited',
      retryable: true,
      provider: 'venice',
    })
    expect(isInferenceError(err)).toBe(true)
  })
})
