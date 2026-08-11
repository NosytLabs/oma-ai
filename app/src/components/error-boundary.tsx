"use client";

// NOTE: No `lucide-react` imports in this file. The Next.js 15 dev-mode
// React Refresh + barrel-loader bug (documented at next.config.ts:39-81)
// can crash any client component that imports from `lucide-react` during
// HMR. If the ErrorBoundary itself depended on lucide, its fallback would
// also crash — leaving users with a blank screen instead of "System Fault".
// Glyphs render unconditionally via CSS, so the fallback always shows.
//
// If a future Next.js patch fixes the dev HMR bug, lucide can return here.

import { Component, type ReactNode } from "react";

interface Props {
	children: ReactNode;
	fallback?: ReactNode;
}

interface State {
	hasError: boolean;
	error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		if (process.env.NODE_ENV === "development") {
			console.error("ErrorBoundary caught:", error, errorInfo);
		}
	}

	handleReset = () => {
		this.setState({ hasError: false, error: null });
	};

	render() {
		if (this.state.hasError) {
			if (this.props.fallback) {
				return this.props.fallback;
			}
			return (
				<div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 px-4">
					<div
						className="flex h-16 w-16 items-center justify-center rounded-full border border-red/30 bg-red/10 text-red"
						role="img"
						aria-label="System fault warning"
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8" aria-hidden="true">
							<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/>
							<path d="M12 9v4"/>
							<path d="M12 17h.01"/>
						</svg>
					</div>
					<div className="text-center">
						<h2 className="font-mono text-text text-lg mb-2">System Fault</h2>
						<p className="text-sm text-text-muted max-w-md font-mono">
							{this.state.error?.message || "An unexpected error occurred"}
						</p>
					</div>
					<button
						type="button"
						onClick={this.handleReset}
						className="btn-primary flex items-center gap-2 active:scale-[0.97]"
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
							<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
							<path d="M21 3v5h-5"/>
						</svg>
						Retry
					</button>
				</div>
			);
		}

		return this.props.children;
	}
}
