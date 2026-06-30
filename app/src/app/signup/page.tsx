import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Sign Up',
  description:
    'OMA uses wallet-based authentication. Connect a wallet or generate a 16-digit account number — no email, no password, no KYC.',
  robots: { index: false, follow: true },
}

/**
 * /signup: OMA does not have a traditional signup flow — there is no
 * email/password to register. Authentication is wallet-based (SIWE) or
 * account-number-based (a 16-digit number generated on the fly, no PII).
 *
 * We redirect to /login so anyone landing here from a stale link or
 * search result gets to the right place with a single click.
 */
export default function SignupPage() {
  redirect('/login')
}