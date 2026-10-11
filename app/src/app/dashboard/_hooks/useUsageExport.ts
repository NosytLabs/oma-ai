"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

interface Options {
	userId?: string;
	enabled: boolean;
	range: { since?: string; until: string } | null;
	rangeLabel: string;
}

/** Download one selected-range report; account changes invalidate pending data. */
export function useUsageExport({ userId, enabled, range, rangeLabel }: Options) {
	const toast = useToast();
	const [exporting, setExporting] = useState(false);
	const pending = useRef<AbortController | null>(null);
	useEffect(() => () => { pending.current?.abort(); }, [userId, enabled]);
	const exportUsage = useCallback(async () => {
		if (!enabled || !userId || !range || pending.current) return;
		const controller = new AbortController();
		pending.current = controller;
		setExporting(true);
		try {
			const report = await api.exportData.usageReport("csv", { ...range, signal: controller.signal });
			if (controller.signal.aborted) return;
			if (report.rowCount === null) throw new Error("Export details unavailable. Refresh and try again.");
			const url = URL.createObjectURL(report.blob);
			const link = document.createElement("a");
			try {
				link.href = url;
				link.download = `oma-usage-${rangeLabel}-${new Date().toISOString().slice(0, 10)}.csv`;
				document.body.appendChild(link);
				link.click();
			} finally {
				link.remove();
				URL.revokeObjectURL(url);
			}
			if (report.truncated) toast.info(`Exported ${report.rowCount.toLocaleString()} requests. Choose a smaller date range to include every request.`);
			else toast.success(`Exported ${report.rowCount.toLocaleString()} ${report.rowCount === 1 ? "request" : "requests"} for ${rangeLabel}`);
		} catch (error) {
			if (!controller.signal.aborted) toast.error(error instanceof Error ? error.message : "Export failed");
		} finally {
			if (pending.current === controller) {
				pending.current = null;
				setExporting(false);
			}
		}
	}, [enabled, userId, range, rangeLabel, toast]);
	return { exporting, exportUsage };
}
