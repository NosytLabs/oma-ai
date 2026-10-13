const labels: Record<string, string> = {
	pending: "Pending",
	settling: "Confirming",
	completed: "Completed",
	failed: "Failed",
	expired: "Expired",
	refunded: "Refunded",
};

/** Customer labels for the deposit states returned by the gateway. */
export function depositStatusLabel(status: string): string {
	return labels[status] ?? "Unknown";
}
