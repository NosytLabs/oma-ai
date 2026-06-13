/**
 * Centralized frontend configuration constants.
 *
 * Validated with zod. This module runs in both:
 * - Node.js (server components, route handlers, middleware in Node runtime)
 * - Edge runtime (middleware.ts via `jose.jwtVerify`)
 *
 * Edge runtime cannot use zod's `parse()` directly with no-default-required
 * semantics if any field is missing. So all fields have `.default()` or
 * are optional, and the parse never throws.
 *
 * `JWT_SECRET` is required for middleware to do JWT verification; the
 * zod schema validates min length (matches server-side requirement).
 */

import { z } from 'zod'

const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z
    .string()
    .url()
    .or(z.literal(''))
    .default('http://localhost:3001'),
  NEXT_PUBLIC_APP_URL: z.string().url().or(z.literal('')).default('https://oma-ai.com'),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters')
    .default(''), // Defaulted so Edge-runtime parse never throws; middleware redirects to / on empty.
})

/** Default backend API base URL. Strips trailing slashes. */
const rawApi = (envSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  JWT_SECRET: process.env.JWT_SECRET,
})).NEXT_PUBLIC_API_URL

export const DEFAULT_API_URL = (rawApi || 'http://localhost:3001').replace(/\/+$/, '')

/** Secret used to verify the session JWT in middleware. */
export const JWT_SECRET = process.env.JWT_SECRET ?? ''
