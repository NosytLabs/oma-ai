"use client";

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
import { playToastCue } from "@/lib/sound";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/components/ui/utils";

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
	return context ?? noopContext;
}

export function ToastProvider({ children }: { children: ReactNode }) {
	const [toasts, setToasts] = useState<Toast[]>([]);
	const uniqueId = useId();

	const dismiss = useCallback((id: string) => {
		setToasts((prev) => prev.filter((t) => t.id !== id));
	}, []);

	const toast = useCallback(
		(message: string, type: ToastType = "info") => {
			const id = `${uniqueId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
			setToasts((prev) => [...prev, { id, message, type }]);
			playToastCue(type);
		},
		[uniqueId],
	);

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
				className="fixed inset-x-3 bottom-3 z-[100] flex flex-col gap-3 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-auto sm:max-w-[400px] pointer-events-none"
				role="status"
				aria-live="polite"
				aria-label="Notifications"
			>
				<AnimatePresence mode="popLayout">
					{toasts.map((t) => (
						<ToastItem
							key={t.id}
							toast={t}
							onDismiss={() => dismiss(t.id)}
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
}: {
	toast: Toast;
	onDismiss: () => void;
}) {
	const [isHovered, setIsHovered] = useState(false);
	const [progress, setProgress] = useState(100);
	const duration = 4000; // 4 seconds auto-dismiss
	const elapsedRef = useRef(0);
	const lastTickRef = useRef(0);

	useEffect(() => {
		lastTickRef.current = Date.now();
		const interval = setInterval(() => {
			if (!isHovered) {
				const now = Date.now();
				const delta = now - lastTickRef.current;
				elapsedRef.current += delta;

				const remaining = Math.max(0, 100 - (elapsedRef.current / duration) * 100);
				setProgress(remaining);

				if (elapsedRef.current >= duration) {
					clearInterval(interval);
					onDismiss();
				}
			}
			lastTickRef.current = Date.now();
		}, 16); // Smooth tick at ~60fps

		return () => clearInterval(interval);
	}, [isHovered, onDismiss]);

	useEffect(() => {
		lastTickRef.current = Date.now();
	}, [isHovered]);

	const icons = {
		success: <CheckCircle2 className="h-4.5 w-4.5 text-success shrink-0" />,
		error: <AlertTriangle className="h-4.5 w-4.5 text-error shrink-0" />,
		info: <Info className="h-4.5 w-4.5 text-info shrink-0" />,
	};

	const styles = {
		success: "border-success/20 bg-[color-mix(in_srgb,var(--color-success)_4%,var(--color-void-deep))] shadow-[0_4px_24px_rgba(52,211,153,0.1)]",
		error: "border-error/20 bg-[color-mix(in_srgb,var(--color-error)_4%,var(--color-void-deep))] shadow-[0_4px_24px_rgba(248,113,113,0.1)]",
		info: "border-info/20 bg-[color-mix(in_srgb,var(--color-info)_4%,var(--color-void-deep))] shadow-[0_4px_24px_rgba(88,166,255,0.1)]",
	};

	const progressColors = {
		success: "bg-success",
		error: "bg-error",
		info: "bg-info",
	};

	const labelNames = {
		success: "SUCCESS",
		error: "ALERT",
		info: "SYSTEM",
	};

	return (
		<motion.div
			layout
			initial={{ opacity: 0, y: 15, scale: 0.9, x: 50 }}
			animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
			exit={{ opacity: 0, scale: 0.85, x: 80, transition: { duration: 0.18 } }}
			transition={{ type: "spring", stiffness: 380, damping: 26 }}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			className={cn(
				"relative flex items-start gap-3 rounded-lg border px-4 py-3.5 backdrop-blur-md",
				"min-w-[280px] max-w-[400px] overflow-hidden pointer-events-auto",
				styles[toast.type],
			)}
		>
			<div className="pt-0.5">{icons[toast.type]}</div>
			<div className="flex-1 flex flex-col gap-0.5">
				<span className="text-[10px] font-mono font-semibold tracking-wider text-text-muted">
					[{labelNames[toast.type]}]
				</span>
				<span className="text-sm font-medium text-text-bright leading-snug">
					{toast.message}
				</span>
			</div>
			<button
				type="button"
				onClick={onDismiss}
				aria-label="Dismiss notification"
				className={cn(
					"rounded-md min-h-8 min-w-8 flex items-center justify-center p-1.5",
					"hover:bg-text-bright/10 text-text-secondary hover:text-text-bright",
					"transition-all duration-200 shrink-0 focus-visible:outline-none",
					"focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
					"focus-visible:ring-offset-surface hover:rotate-90 hover:scale-105 active:scale-95",
				)}
			>
				<X className="h-4 w-4" />
			</button>

			{/* Auto-dismiss Animated Progress Bar */}
			<div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/5">
				<div
					className={cn("h-full transition-all duration-[16ms] ease-linear origin-left", progressColors[toast.type])}
					style={{ width: `${progress}%` }}
				/>
			</div>
		</motion.div>
	);
}
