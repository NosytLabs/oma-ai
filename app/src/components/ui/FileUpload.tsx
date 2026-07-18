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
					className="absolute top-3 right-3 p-2 bg-surface/90 backdrop-blur-sm rounded-xl text-text-muted hover:text-error hover:bg-surface shadow-lg transition-all"
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
				className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 cursor-pointer transition-all ${
					dragOver
						? "border-accent bg-accent-dim/50"
						: "border-border hover:border-accent hover:bg-accent-dim/20"
				}`}
			>
				<div className="w-12 h-12 rounded-2xl bg-accent-dim flex items-center justify-center">
					<Upload className="w-6 h-6 text-accent" />
				</div>
				<div className="text-center">
					<p className="text-sm font-medium text-text">
						Drop an image here or <span className="text-accent">browse</span>
					</p>
					<p className="text-xs text-text-muted mt-1">
						PNG, JPG, WebP up to {maxSizeMB}MB
					</p>
				</div>
			</button>
			<input
				ref={inputRef}
				type="file"
				accept={accept}
				onChange={handleChange}
				aria-label="File upload"
				className="hidden"
			/>
			{error && (
				<p className="mt-2 text-sm text-error flex items-center gap-1.5">
					<ImageIcon className="w-4 h-4" />
					{error}
				</p>
			)}
		</div>
	);
}
