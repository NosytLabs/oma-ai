"use client";

import { Eye, Search, Users } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import type { AdminUser } from "@/lib/api/admin";
import { formatAddress, formatDateShort, formatUsd } from "@/lib/utils";

type UsersTabProps = {
	filteredUsers: AdminUser[];
	usersLoading: boolean;
	usersTotal: number;
	usersPage: number;
	searchQuery: string;
	setSearchQuery: (query: string) => void;
	setUsersPage: (page: number) => void;
};

export function UsersTab({
	filteredUsers,
	usersLoading,
	usersTotal,
	usersPage,
	searchQuery,
	setSearchQuery,
	setUsersPage,
}: UsersTabProps) {
	return (
		<div className="space-y-4">
			<div className="flex items-center gap-4">
				<div className="relative flex-1 max-w-md">
					<Search
						className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted"
						aria-hidden="true"
					/>
					<input
						type="search"
						placeholder="Search by address or account number..."
						aria-label="Search users by address or account number"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="w-full pl-10 pr-4 py-2 rounded border border-border bg-surface text-text placeholder:text-text-muted focus:outline-none focus:border-accent/50"
					/>
				</div>
				<div className="flex items-center gap-2 text-xs text-text-muted font-mono">
					<span>{usersTotal} total users</span>
				</div>
			</div>

			<div className="rounded border border-border bg-surface overflow-hidden">
				<div className="px-4 py-3 border-b border-border bg-panel">
					<h3 className="text-sm font-bold font-mono uppercase tracking-wider text-text-secondary">
						Users
					</h3>
				</div>
				<div className="overflow-x-auto">
					<table className="w-full text-left text-sm">
						<thead>
							<tr className="border-b border-border bg-surface">
								<th
									scope="col"
									className="px-4 py-3 font-medium text-text-muted text-xs font-mono uppercase tracking-wider"
								>
									Address
								</th>
								<th
									scope="col"
									className="px-4 py-3 font-medium text-text-muted text-xs font-mono uppercase tracking-wider text-right"
								>
									Balance
								</th>
								<th
									scope="col"
									className="px-4 py-3 font-medium text-text-muted text-xs font-mono uppercase tracking-wider text-right"
								>
									Total Deposited
								</th>
								<th
									scope="col"
									className="px-4 py-3 font-medium text-text-muted text-xs font-mono uppercase tracking-wider text-right"
								>
									Total Used
								</th>
								<th
									scope="col"
									className="px-4 py-3 font-medium text-text-muted text-xs font-mono uppercase tracking-wider text-right"
								>
									Requests
								</th>
								<th
									scope="col"
									className="px-4 py-3 font-medium text-text-muted text-xs font-mono uppercase tracking-wider"
								>
									Last Active
								</th>
								<th
									scope="col"
									className="px-4 py-3 font-medium text-text-muted text-xs font-mono uppercase tracking-wider"
								></th>
							</tr>
						</thead>
						<tbody>
							{filteredUsers.map((user) => (
								<tr
									key={user.id}
									className="border-b border-border/50 hover:bg-surface/50"
								>
									<td className="px-4 py-3">
										<div className="font-mono text-sm text-text-secondary">
											{formatAddress(user.address)}
										</div>
									</td>
									<td className="px-4 py-3 text-right font-mono text-accent">
										{formatUsd(user.balanceCredits)}
									</td>
									<td className="px-4 py-3 text-right font-mono text-success">
										{formatUsd(user.totalDeposited)}
									</td>
									<td className="px-4 py-3 text-right font-mono text-amber">
										{formatUsd(user.totalUsed)}
									</td>
									<td className="px-4 py-3 text-right font-mono text-text-muted">
										{user.totalRequests?.toLocaleString() || 0}
									</td>
									<td className="px-4 py-3 text-text-muted font-mono text-xs">
										{user.lastActivityAt
											? formatDateShort(user.lastActivityAt)
											: "Never"}
									</td>
									<td className="px-4 py-3">
										<Link
											href={`/admin/users/${user.id}`}
											aria-label={`View user ${formatAddress(user.address)}`}
											className="p-1.5 rounded hover:bg-panel text-text-muted hover:text-accent transition-colors inline-flex"
										>
											<Eye className="w-4 h-4" aria-hidden="true" />
										</Link>
									</td>
								</tr>
							))}
							{filteredUsers.length === 0 && !usersLoading && (
								<tr>
									<td colSpan={7} className="px-4 py-8 text-center">
										<EmptyState
											variant="table"
											icon={Users}
											title="No users found"
										/>
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</div>

			<div className="flex items-center justify-between">
				<button
					type="button"
					onClick={() => setUsersPage(usersPage - 1)}
					disabled={usersPage <= 1}
					className="px-4 py-2 rounded border border-border bg-surface text-text-secondary hover:text-text hover:border-border-bright disabled:opacity-30 disabled:cursor-not-allowed disabled:border-border/50 disabled:text-text-muted text-sm font-mono transition-colors"
				>
					Previous
				</button>
				<span className="text-xs text-text-muted font-mono">
					Page {usersPage} of {Math.ceil(usersTotal / 50) || 1}
				</span>
				<button
					type="button"
					onClick={() => setUsersPage(usersPage + 1)}
					disabled={usersPage >= Math.ceil(usersTotal / 50)}
					className="px-4 py-2 rounded border border-border bg-surface text-text-secondary hover:text-text hover:border-border-bright disabled:opacity-30 disabled:cursor-not-allowed disabled:border-border/50 disabled:text-text-muted text-sm font-mono transition-colors"
				>
					Next
				</button>
			</div>
		</div>
	);
}
