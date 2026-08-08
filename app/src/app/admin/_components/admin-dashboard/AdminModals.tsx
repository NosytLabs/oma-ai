"use client";

import { CreditAdjustmentModal } from "../modals/CreditAdjustmentModal";
import { SuspendUserModal } from "../modals/SuspendUserModal";
import { UserAnonymizationModal } from "../modals/UserAnonymizationModal";

export function AdminModals() {
	return (
		<>
			<CreditAdjustmentModal />
			<SuspendUserModal />
			<UserAnonymizationModal />
		</>
	);
}
