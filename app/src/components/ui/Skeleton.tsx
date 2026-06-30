interface SkeletonProps {
	className?: string;
	variant?: "text" | "circular" | "rectangular";
	width?: string | number;
	height?: string | number;
	animation?: "pulse" | "wave" | "none";
}

export function Skeleton({
	className = "",
	variant = "rectangular",
	width,
	height,
	animation = "pulse",
}: SkeletonProps) {
	const variantClasses = {
		text: "rounded h-3",
		circular: "rounded-full",
		rectangular: "rounded",
	};
	const animationClasses = {
		pulse: "animate-pulse",
		wave: "animate-shimmer",
		none: "",
	};

	return (
		<div
			role="status"
			aria-label="Loading"
			className={`skeleton ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
			style={{
				width: typeof width === "number" ? `${width}px` : width,
				height: typeof height === "number" ? `${height}px` : height,
			}}
		/>
	);
}

export function SkeletonKeyList({ count = 3 }: { count?: number }) {
	return (
		<div className="space-y-3">
			{Array.from({ length: count }).map((_, i) => (
				<div key={i} className="card flex items-center gap-4 py-4">
					<Skeleton className="h-10 w-10 rounded-lg" />
					<div className="flex-1 space-y-2">
						<Skeleton className="h-4 w-32" />
						<Skeleton className="h-3 w-24" />
					</div>
					<div className="flex gap-2">
						<Skeleton className="h-8 w-8 rounded-lg" />
						<Skeleton className="h-8 w-8 rounded-lg" />
					</div>
				</div>
			))}
		</div>
	);
}
