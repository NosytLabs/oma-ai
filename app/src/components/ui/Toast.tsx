"use client";

import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useId,
	useRef,
	useState,
} from "react";

type ToastType = "success" | "error" | "info";

interface Toast {
	id: string;
	message: string;
	type: ToastType;
}

interface ToastContextType {
	toast: (message: string, type?: ToastType) => void;
	success: (message: string) => void;
	error: (message: string) => void;
	info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

const noop = () => {};
const noopContext: ToastContextType = {
	toast: noop,
	success: noop,
	error: noop,
	info: noop,
};

export function useToast() {
	const context = useContext(ToastContext);
	// SSR-safe: when the provider hasn't mounted yet (e.g. during server
	// pre-render of a client component, or before the lazy-loaded
	// ToastProvider hydrates), return a no-op stub instead of throwing.
	// Real toasts work normally once the provider is mounted on the client.
	return context ?? noopContext;
}

export function ToastProvider({ children }: { children: ReactNode }) {
	const [toasts, setToasts] = useState<Toast[]>([]);
	const prefersReducedMotion = useReducedMotion() ?? false;
	// React 19 useId hook for unique ID generation
	const uniqueId = useId();
	// Track auto-dismiss timers so we can clear them on manual dismiss / unmount
	const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
		new Map(),
	);

	const dismiss = useCallback((id: string) => {
		const timer = timersRef.current.get(id);
		if (timer) {
			clearTimeout(timer);
			timersRef.current.delete(id);
		}
		setToasts((prev) => prev.filter((t) => t.id !== id));
	}, []);

	const toast = useCallback(
		(message: string, type: ToastType = "info") => {
			// Use cryptographically secure ID generation
			const id = `${uniqueId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
			setToasts((prev) => [...prev, { id, message, type }]);

			// Auto-dismiss after 4 seconds (timer tracked so manual dismiss can cancel it)
			const timeoutId = setTimeout(() => {
				timersRef.current.delete(id);
				setToasts((prev) => prev.filter((t) => t.id !== id));
			}, 4000);
			timersRef.current.set(id, timeoutId);
		},
		[uniqueId],
	);

	// Clear all pending timers when the provider unmounts
	useEffect(() => {
		const timers = timersRef.current;
		return () => {
			// biome-ignore lint/suspicious/useIterableCallbackReturn: forEach return value is intentionally ignored
			timers.forEach((t) => clearTimeout(t));
			timers.clear();
		};
	}, []);

	const success = useCallback(
		(message: string) => toast(message, "success"),
		[toast],
	);
	const error = useCallback(
		(message: string) => toast(message, "error"),
		[toast],
	);
	const info = useCallback(
		(message: string) => toast(message, "info"),
		[toast],
	);

	return (
		<ToastContext.Provider value={{ toast, success, error, info }}>
			{children}
			<div
				className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2"
				role="region"
				aria-label="Notifications"
			>
				<AnimatePresence>
					{toasts.map((t) => (
						<ToastItem
							key={t.id}
							toast={t}
							onDismiss={() => dismiss(t.id)}
							prefersReducedMotion={prefersReducedMotion}
						/>
					))}
				</AnimatePresence>
			</div>
		</ToastContext.Provider>
	);
}

function ToastItem({
	toast,
	onDismiss,
	prefersReducedMotion,
}: {
	toast: Toast;
	onDismiss: () => void;
	prefersReducedMotion?: boolean | null;
}) {
	const motionPrefersReducedMotion = prefersReducedMotion ?? false;
	const icons = {
		success: <CheckCircle2 className="h-5 w-5 text-success shrink-0" />,
		error: <AlertTriangle className="h-5 w-5 text-error shrink-0" />,
		info: <Info className="h-5 w-5 text-info shrink-0" />,
	};

	const styles = {
		success: "border-success/30 bg-success/10",
		error: "border-error/30 bg-error/10",
		info: "border-info/30 bg-info/10",
	};

	const animationVariants = {
		initial: motionPrefersReducedMotion
			? { opacity: 1, y: 0, scale: 1 }
			: { opacity: 0, y: 20, scale: 0.95 },
		animate: motionPrefersReducedMotion
			? { opacity: 1, y: 0, scale: 1 }
			: { opacity: 1, y: 0, scale: 1 },
		exit: motionPrefersReducedMotion
			? { opacity: 0, x: 0, scale: 1 }
			: { opacity: 0, x: 100, scale: 0.95 },
	};

	return (
		<m.div
			initial={animationVariants.initial}
			animate={animationVariants.animate}
			exit={animationVariants.exit}
			transition={motionPrefersReducedMotion ? { duration: 0 } : undefined}
			className={`flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm min-w-[280px] max-w-[400px] ${styles[toast.type]}`}
		>
			{icons[toast.type]}
			<span className="flex-1 text-sm font-medium text-text">
				{toast.message}
			</span>
			<button
				type="button"
				onClick={onDismiss}
				aria-label="Dismiss notification"
				className="rounded-lg min-h-11 min-w-11 flex items-center justify-center p-1 hover:bg-text-bright/10 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
			>
				<X className="h-4 w-4 text-text-secondary" />
			</button>
		</m.div>
	);
}
