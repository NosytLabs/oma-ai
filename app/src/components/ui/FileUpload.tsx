"use client";

import { Image as ImageIcon, Upload, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useRef, useState } from "react";

interface FileUploadProps {
	onFileSelect: (file: File, dataUrl: string) => void;
	onClear: () => void;
	accept?: string;
	maxSizeMB?: number;
	className?: string;
}

export function FileUpload({
	onFileSelect,
	onClear,
	accept = "image/*",
	maxSizeMB = 10,
	className = "",
}: FileUploadProps) {
	const [preview, setPreview] = useState<string | null>(null);
	const [dragOver, setDragOver] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const handleFile = useCallback(
		(file: File) => {
			setError(null);
			if (!file.type.startsWith("image/")) {
				setError("Please select an image file");
				return;
			}
			if (file.size > maxSizeMB * 1024 * 1024) {
				setError(`File too large (max ${maxSizeMB}MB)`);
				return;
			}
			const reader = new FileReader();
			reader.onload = () => {
				const dataUrl = reader.result as string;
				setPreview(dataUrl);
				onFileSelect(file, dataUrl);
			};
			reader.readAsDataURL(file);
		},
		[maxSizeMB, onFileSelect],
	);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			setDragOver(false);
			const file = e.dataTransfer.files[0];
			if (file) handleFile(file);
		},
		[handleFile],
	);

	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (file) handleFile(file);
		},
		[handleFile],
	);

	const handleClear = useCallback(() => {
		setPreview(null);
		setError(null);
		if (inputRef.current) inputRef.current.value = "";
		onClear();
	}, [onClear]);

	const hintId = `file-upload-hint-${accept.replace(/\W+/g, "-")}`;
	const errorId = `file-upload-error`;
	const describedBy = [hintId, error ? errorId : ""].filter(Boolean).join(" ");

	if (preview) {
		return (
			<div
				className={`relative rounded-2xl border border-border overflow-hidden ${className}`}
			>
				<Image
					src={preview}
					alt="Upload preview"
					fill
					className="object-cover"
				/>
				<button
					type="button"
					onClick={handleClear}
					aria-label="Remove image"
					className="absolute top-3 right-3 p-2 bg-[var(--color-surface)]/90 backdrop-blur-sm rounded-full text-text-muted hover:text-[var(--color-error)] hover:bg-[var(--color-surface-elevated)] shadow-lg transition-[background-color,border-color,color,transform,box-shadow,opacity] active:scale-[0.97]"
				>
					<X className="w-4 h-4" />
				</button>
			</div>
		);
	}

	return (
		<div className={className}>
			<button
				type="button"
				onDragOver={(e) => {
					e.preventDefault();
					setDragOver(true);
				}}
				onDragLeave={() => setDragOver(false)}
				onDrop={handleDrop}
				onClick={() => inputRef.current?.click()}
				aria-label={`Upload ${accept === "image/*" ? "image" : "file"}`}
				aria-describedby={describedBy || undefined}
				className={`w-full flex flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border-2 border-dashed p-8 cursor-pointer transition-[background-color,border-color,color,transform,box-shadow,opacity] duration-200 ease-out active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-void ${
					dragOver
						? "border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)]"
						: "border-[var(--color-border)] hover:border-[var(--color-accent)] hover:bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)]"
				}`}
			>
				<div className="w-12 h-12 rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] flex items-center justify-center">
					<Upload className="w-6 h-6 text-[var(--color-accent)]" aria-hidden="true" />
				</div>
				<div className="text-center">
					<p className="text-sm font-medium text-text-primary">
						Drop an image here or <span className="text-[var(--color-accent)]">browse</span>
					</p>
					<p id={hintId} className="text-xs text-text-muted mt-1">
						PNG, JPG, WebP up to {maxSizeMB}MB
					</p>
				</div>
			</button>
			<input
				ref={inputRef}
				type="file"
				accept={accept}
				onChange={handleChange}
				tabIndex={-1}
				aria-hidden="true"
				className="hidden"
			/>
			{error && (
				<p id={errorId} role="alert" className="mt-2 text-sm text-[var(--color-error)] flex items-center gap-1.5">
					<ImageIcon className="w-4 h-4" aria-hidden="true" />
					{error}
				</p>
			)}
		</div>
	);
}
