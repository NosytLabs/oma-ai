"use client";

import {
	createContext,
	useContext,
	type Dispatch,
	type SetStateAction,
} from "react";
import type {
	AdminSettings,
	AdminUser,
	AuditPage,
	Health,
	Integration,
	ModelRow,
	PolarCheckout,
	PolarCustomer,
	PolarPayment,
	PolarProduct,
	PolarSubscription,
	PolarTab,
	RecentRow,
	TimeWindow,
	UsageResponse,
} from "./types";

export type AdminDashboardContextValue = {
	// data
	windowSel: TimeWindow;
	setWindowSel: (w: TimeWindow) => void;
	usage: UsageResponse | null;
	models: ModelRow[];
	recent: RecentRow[];
	health: Health | null;
	integrations: Integration | null;
	settings: AdminSettings | null;
	users: AdminUser[];
	loading: boolean;
	refreshAll: () => void | Promise<void>;
	totalMarginPct: number;
	// settings
	togglingSetting: keyof AdminSettings | null;
	handleToggleSetting: (
		key: "maintenanceMode" | "cardPaymentsEnabled" | "cryptoPaymentsEnabled",
	) => void | Promise<void>;
	// models
	editingId: string | null;
	editInput: string;
	editOutput: string;
	setEditingId: (id: string | null) => void;
	setEditInput: (v: string) => void;
	setEditOutput: (v: string) => void;
	handleEdit: (modelId: string) => void | Promise<void>;
	startEdit: (m: ModelRow) => void;
	// users
	userSearch: string;
	setUserSearch: (v: string) => void;
	selectedUserId: string | null;
	selectedUserHistory: RecentRow[] | null;
	loadingHistory: boolean;
	handleViewUserHistory: (userId: string) => void | Promise<void>;
	creditAdjustAmount: Record<string, string>;
	setCreditAdjustAmount: Dispatch<SetStateAction<Record<string, string>>>;
	handleCreditAdjust: (userId: string, isTopUp: boolean) => void | Promise<void>;
	handleSuspendAction: (userId: string, currentlySuspended: boolean) => void;
	setDeleteUserModal: (v: { userId: string; name: string } | null) => void;
	updatingSettings: boolean;
	setSelectedUserId: (id: string | null) => void;
	setSelectedUserHistory: (rows: RecentRow[] | null) => void;
	// polar
	polarTab: PolarTab;
	setPolarTab: (t: PolarTab) => void;
	polarPayments: PolarPayment[];
	setPolarPayments: Dispatch<SetStateAction<PolarPayment[]>>;
	polarCustomers: PolarCustomer[];
	setPolarCustomers: Dispatch<SetStateAction<PolarCustomer[]>>;
	polarProducts: PolarProduct[];
	setPolarProducts: Dispatch<SetStateAction<PolarProduct[]>>;
	polarSubscriptions: PolarSubscription[];
	setPolarSubscriptions: Dispatch<SetStateAction<PolarSubscription[]>>;
	polarLoading: boolean;
	setPolarLoading: Dispatch<SetStateAction<boolean>>;
	polarError: string | null;
	setPolarError: Dispatch<SetStateAction<string | null>>;
	checkoutProduct: string;
	setCheckoutProduct: (v: string) => void;
	checkoutEmail: string;
	setCheckoutEmail: (v: string) => void;
	checkoutName: string;
	setCheckoutName: (v: string) => void;
	checkoutSuccess: string;
	setCheckoutSuccess: (v: string) => void;
	checkoutCancel: string;
	setCheckoutCancel: (v: string) => void;
	checkoutResult: PolarCheckout | null;
	setCheckoutResult: Dispatch<SetStateAction<PolarCheckout | null>>;
	// refund
	refundForm: { paymentId: string; amountCents: string; reason: string; userId: string };
	setRefundForm: Dispatch<
		SetStateAction<{ paymentId: string; amountCents: string; reason: string; userId: string }>
	>;
	refundSubmitting: boolean;
	handleRefundSubmit: () => void | Promise<void>;
	// audit
	auditEntries: AuditPage | null;
	auditFilters: { action: string; userId: string; from: string; to: string };
	setAuditFilters: Dispatch<
		SetStateAction<{ action: string; userId: string; from: string; to: string }>
	>;
	auditLoading: boolean;
	loadAudit: (cursor: string | null, pushStack: boolean) => void | Promise<void>;
	handleAuditPrev: () => void;
	auditCursor: string | null;
	auditCursorStack: string[];
	// modals
	creditAdjustModal: { userId: string; direction: "add" | "remove" } | null;
	setCreditAdjustModal: (v: { userId: string; direction: "add" | "remove" } | null) => void;
	creditAdjustReason: string;
	setCreditAdjustReason: (v: string) => void;
	handleConfirmCreditAdjust: () => void | Promise<void>;
	suspendModal: {
		userId: string;
		action: "suspend" | "unsuspend";
		suspended: boolean;
	} | null;
	setSuspendModal: (
		v: { userId: string; action: "suspend" | "unsuspend"; suspended: boolean } | null,
	) => void;
	suspendReason: string;
	setSuspendReason: (v: string) => void;
	handleConfirmSuspend: () => void | Promise<void>;
	deleteUserModal: { userId: string; name: string } | null;
	deleteUserConfirmation: string;
	setDeleteUserConfirmation: (v: string) => void;
	deleteUserReason: string;
	setDeleteUserReason: (v: string) => void;
	deletingUser: boolean;
	handleDeleteUser: () => void | Promise<void>;
};

const AdminDashboardContext = createContext<AdminDashboardContextValue | null>(null);

export function AdminDashboardProvider({
	value,
	children,
}: {
	value: AdminDashboardContextValue;
	children: React.ReactNode;
}) {
	return (
		<AdminDashboardContext.Provider value={value}>{children}</AdminDashboardContext.Provider>
	);
}

export function useAdminDashboard(): AdminDashboardContextValue {
	const ctx = useContext(AdminDashboardContext);
	if (!ctx) {
		throw new Error("useAdminDashboard must be used within AdminDashboardProvider");
	}
	return ctx;
}
