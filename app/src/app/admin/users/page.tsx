import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

// The user list lives on the main admin dashboard (`/admin`).
// `/admin/users` is kept as a stable deep-link target by redirecting
// straight there.
export default function AdminUsersIndex() {
  redirect('/admin')
}
