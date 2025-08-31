"use client";

import type React from "react";
import {useEffect, useMemo, useRef, useState} from "react";
import {
	Sun,
	Moon,
	Sparkles,
	ImagePlus,
	TypeIcon,
	Palette,
	Shapes,
	Tag,
	Trash2,
	RotateCcw,
	DownloadIcon,
	HistoryIcon,
	Monitor,
} from "lucide-react";

type Category = "Education" | "Cooking" | "Vlog" | "Gaming" | "Tech" | "Other";
type Style = "Minimal" | "Bold" | "Fun" | "Professional" | "Custom";
type Vibe = "Bright" | "Dark" | "Pastel" | "Neon" | "Custom";

type FormAnswers = {
	category: Category;
	customCategory: string;
	style: Style;
	customStyle: string;
	textOverlay: string;
	vibe: Vibe;
	customVibe: string;
};

type HistoryItem = {
	data_url: string;
	prompt: string;
	answers: FormAnswers;
	timestamp: number;
};

type Theme = "light" | "dark";

const DEFAULT_ANSWERS: FormAnswers = {
	category: "Tech",
	customCategory: "",
	style: "Minimal",
	customStyle: "",
	textOverlay: "",
	vibe: "Bright",
	customVibe: "",
};

function formatTimestamp(ts: number) {
	try {
		return new Date(ts).toLocaleString();
	} catch {
		return "";
	}
}

function composePrompt(answers: FormAnswers, hasImage: boolean) {
	const categoryText =
		answers.category === "Other"
			? answers.customCategory || "Other"
			: answers.category;

	const styleText =
		answers.style === "Custom"
			? answers.customStyle || "Custom"
			: answers.style;

	const vibeText =
		answers.vibe === "Custom" ? answers.customVibe || "Custom" : answers.vibe;

	const overlay =
		answers.textOverlay && answers.textOverlay.trim().length > 0
			? `Include text overlay: "${answers.textOverlay.trim()}".`
			: "No text overlay.";

	const parts = [
		`Category: ${categoryText}.`,
		`Style: ${styleText}.`,
		`Colors/Vibe: ${vibeText}.`,
		overlay,
	];

	if (hasImage) {
		parts.push("Use the uploaded reference image as visual guidance.");
	}

	// Always append the guidelines:
	parts.push(
		"16:9 thumbnail composition, high contrast, no watermarks, suitable for social/YouTube."
	);

	return parts.join(" ");
}

async function fileToBase64(
	file: File
): Promise<{base64: string; mime: string}> {
	const mime = file.type || "image/png";
	const dataUrl: string = await new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(new Error("Failed to read file"));
		reader.onload = () => resolve(String(reader.result));
		reader.readAsDataURL(file);
	});
	const base64 = dataUrl.split(",")[1] || "";
	return {base64, mime};
}

export default function Page() {
	// Theme
	const [theme, setTheme] = useState<Theme>("light");

	// Form and prompt
	const [answers, setAnswers] = useState<FormAnswers>(DEFAULT_ANSWERS);
	const [prompt, setPrompt] = useState<string>("");
	const [promptTouched, setPromptTouched] = useState<boolean>(false);

	// Upload
	const [uploadFile, setUploadFile] = useState<File | null>(null);
	const [uploadPreview, setUploadPreview] = useState<string | null>(null);

	// Result and network
	const [imageUrl, setImageUrl] = useState<string>("");
	const [loading, setLoading] = useState<boolean>(false);
	const [error, setError] = useState<string>("");

	// History
	const [history, setHistory] = useState<HistoryItem[]>([]);
	const historyScrollRef = useRef<HTMLDivElement | null>(null);

	// Remember last request to support "Regenerate"
	const lastRequestRef = useRef<{
		route: "/api/generate" | "/api/edit";
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		payload: any;
	} | null>(null);

	// Derived prompt from answers (without overriding manual edits)
	const derivedPrompt = useMemo(
		() => composePrompt(answers, Boolean(uploadFile)),
		[answers, uploadFile]
	);

	// Initialize theme from localStorage or system preference
	useEffect(() => {
		const stored =
			typeof window !== "undefined" ? localStorage.getItem("theme") : null;
		if (stored === "light" || stored === "dark") {
			setTheme(stored);
			return;
		}
		const prefersDark = window.matchMedia?.(
			"(prefers-color-scheme: dark)"
		).matches;
		setTheme(prefersDark ? "dark" : "light");
	}, []);

	// Apply theme to <html> and persist
	useEffect(() => {
		if (typeof document === "undefined") return;
		const root = document.documentElement;
		if (theme === "dark") root.classList.add("dark");
		else root.classList.remove("dark");
		localStorage.setItem("theme", theme);
	}, [theme]);

	// Initialize prompt (pre-filled) and history from localStorage
	useEffect(() => {
		try {
			const storedHistory = localStorage.getItem("thumbHistory");
			if (storedHistory) {
				const parsed = JSON.parse(storedHistory) as HistoryItem[];
				setHistory(parsed);
			}
		} catch {
			// ignore parse errors
		}
		// initial prefill for prompt
		setPrompt(composePrompt(DEFAULT_ANSWERS, false));
	}, []);

	// Keep prompt synced with answers until user edits manually
	useEffect(() => {
		if (!promptTouched) {
			setPrompt(derivedPrompt);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [derivedPrompt]);

	// Cleanup object URLs on preview change/unmount
	useEffect(() => {
		return () => {
			if (uploadPreview) URL.revokeObjectURL(uploadPreview);
		};
	}, [uploadPreview]);

	function onAnswersChange<K extends keyof FormAnswers>(
		key: K,
		value: FormAnswers[K]
	) {
		setAnswers((prev) => ({...prev, [key]: value}));
	}

	function onFileChange(file: File | null) {
		setUploadFile(file);
		if (uploadPreview) {
			URL.revokeObjectURL(uploadPreview);
			setUploadPreview(null);
		}
		if (file) {
			const url = URL.createObjectURL(file);
			setUploadPreview(url);
		}
	}

	function onClearHistory() {
		setHistory([]);
		try {
			localStorage.removeItem("thumbHistory");
		} catch {
			// ignore storage errors
		}
	}

	function addToHistory(item: HistoryItem) {
		setHistory((prev) => {
			const next = [item, ...prev];
			try {
				localStorage.setItem("thumbHistory", JSON.stringify(next));
			} catch {
				// ignore storage errors
			}
			// Auto-scroll history row to the beginning (we prepend)
			// If you prefer newest at the end, invert array ops and scrollRight.
			requestAnimationFrame(() => {
				if (historyScrollRef.current) {
					historyScrollRef.current.scrollTo({left: 0, behavior: "smooth"});
				}
			});
			return next;
		});
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError("");

		// Build payload
		const activePrompt = (prompt || derivedPrompt).trim();
		if (!activePrompt) {
			setError("Please provide a prompt or complete the guided answers.");
			return;
		}

		setLoading(true);

		try {
			if (uploadFile) {
				const {base64, mime} = await fileToBase64(uploadFile);
				const payload = {
					prompt: activePrompt,
					base64Image: base64,
					mimeType: mime,
				};
				lastRequestRef.current = {route: "/api/edit", payload};
				const res = await fetch("/api/edit", {
					method: "POST",
					headers: {"Content-Type": "application/json"},
					body: JSON.stringify(payload),
				});
				if (!res.ok) {
					const details = await safeReadText(res);
					throw new Error(
						`Edit request failed. ${
							details ? `Details: ${truncate(details, 300)}` : ""
						}`
					);
				}
				const json = (await res.json()) as {data_url: string};
				if (!json?.data_url)
					throw new Error("Invalid response: missing data_url");
				setImageUrl(json.data_url);
				addToHistory({
					data_url: json.data_url,
					prompt: activePrompt,
					answers,
					timestamp: Date.now(),
				});
			} else {
				const payload = {prompt: activePrompt};
				lastRequestRef.current = {route: "/api/generate", payload};
				const res = await fetch("/api/generate", {
					method: "POST",
					headers: {"Content-Type": "application/json"},
					body: JSON.stringify(payload),
				});
				if (!res.ok) {
					const details = await safeReadText(res);
					throw new Error(
						`Generate request failed. ${
							details ? `Details: ${truncate(details, 300)}` : ""
						}`
					);
				}
				const json = (await res.json()) as {data_url: string};
				if (!json?.data_url)
					throw new Error("Invalid response: missing data_url");
				setImageUrl(json.data_url);
				addToHistory({
					data_url: json.data_url,
					prompt: activePrompt,
					answers,
					timestamp: Date.now(),
				});
			}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} catch (err: any) {
			setError(
				err?.message || "Something went wrong while processing your request."
			);
		} finally {
			setLoading(false);
		}
	}

	async function handleRegenerate() {
		if (!lastRequestRef.current) return;
		setError("");
		setLoading(true);
		try {
			const {route, payload} = lastRequestRef.current;
			const res = await fetch(route, {
				method: "POST",
				headers: {"Content-Type": "application/json"},
				body: JSON.stringify(payload),
			});
			if (!res.ok) {
				const details = await safeReadText(res);
				throw new Error(
					`Regenerate failed. ${
						details ? `Details: ${truncate(details, 300)}` : ""
					}`
				);
			}
			const json = (await res.json()) as {data_url: string};
			if (!json?.data_url)
				throw new Error("Invalid response: missing data_url");
			setImageUrl(json.data_url);
			addToHistory({
				data_url: json.data_url,
				prompt: payload.prompt,
				answers,
				timestamp: Date.now(),
			});
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} catch (err: any) {
			setError(err?.message || "Could not regenerate the image.");
		} finally {
			setLoading(false);
		}
	}

	function onSelectHistory(item: HistoryItem) {
		setImageUrl(item.data_url);
		setAnswers(item.answers);
		setPrompt(item.prompt);
		setPromptTouched(true);
		// When selecting from history, we cannot reconstruct the original file.
		// Subsequent regenerations will hit the same route/payload only if lastRequest is still present.
	}

	const primaryButtonLabel = uploadFile ? "Edit Image" : "Generate Image";

	return (
		<main className="font-sans h-dvh overflow-hidden bg-background text-foreground">
			<div className="mx-auto flex h-full max-w-7xl flex-col px-4 py-4">
				{/* Top bar */}
				<header className="mb-3 flex items-center justify-between rounded-xl border border-border bg-card/70 p-3 shadow-sm backdrop-blur">
					<div className="flex items-center gap-2">
						<Sparkles
							className="h-5 w-5 text-primary"
							aria-hidden="true"
						/>
						<h1 className="text-pretty text-lg font-semibold tracking-tight">
							AI Thumbnail Generator
						</h1>
					</div>
					<button
						type="button"
						onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
						className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm transition hover:-translate-y-0.5 hover:shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						aria-label="Toggle theme"
						title="Toggle theme"
					>
						{theme === "dark" ? (
							<>
								<Moon
									className="h-4 w-4"
									aria-hidden="true"
								/>{" "}
								Dark
							</>
						) : (
							<>
								<Sun
									className="h-4 w-4"
									aria-hidden="true"
								/>{" "}
								Light
							</>
						)}
					</button>
				</header>

				{/* Surface-level errors */}
				{error && (
					<div
						role="alert"
						aria-live="polite"
						className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
					>
						{error}
					</div>
				)}

				{/* Body: Two columns (Form left, Preview right) */}
				<div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden md:grid-cols-2">
					{/* LEFT: Form panel */}
					<section
						aria-labelledby="form-title"
						className="overflow-auto rounded-xl border border-border bg-card p-4 shadow-sm"
					>
						<h2
							id="form-title"
							className="sr-only"
						>
							Guided Questions and Prompt
						</h2>

						<form
							onSubmit={handleSubmit}
							aria-busy={loading}
							className="space-y-5"
						>
							{/* Guided controls */}
							<div className="grid grid-cols-1 gap-4">
								{/* Category */}
								<div className="flex flex-col gap-2">
									<label
										htmlFor="category"
										className="flex items-center gap-2 text-sm font-medium"
									>
										<Tag
											className="h-4 w-4 text-muted-foreground"
											aria-hidden="true"
										/>
										Category
									</label>
									<select
										id="category"
										disabled={loading}
										value={answers.category}
										onChange={(e) =>
											onAnswersChange("category", e.target.value as Category)
										}
										className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground transition focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed"
									>
										{[
											"Education",
											"Cooking",
											"Vlog",
											"Gaming",
											"Tech",
											"Other",
										].map((opt) => (
											<option
												key={opt}
												value={opt}
											>
												{opt}
											</option>
										))}
									</select>
									{answers.category === "Other" && (
										<input
											type="text"
											placeholder="Enter category"
											disabled={loading}
											value={answers.customCategory}
											onChange={(e) =>
												onAnswersChange("customCategory", e.target.value)
											}
											className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground transition focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed"
										/>
									)}
								</div>

								{/* Style */}
								<div className="flex flex-col gap-2">
									<label
										htmlFor="style"
										className="flex items-center gap-2 text-sm font-medium"
									>
										<Shapes
											className="h-4 w-4 text-muted-foreground"
											aria-hidden="true"
										/>
										Style
									</label>
									<select
										id="style"
										disabled={loading}
										value={answers.style}
										onChange={(e) =>
											onAnswersChange("style", e.target.value as Style)
										}
										className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground transition focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed"
									>
										{["Minimal", "Bold", "Fun", "Professional", "Custom"].map(
											(opt) => (
												<option
													key={opt}
													value={opt}
												>
													{opt}
												</option>
											)
										)}
									</select>
									{answers.style === "Custom" && (
										<input
											type="text"
											placeholder="Describe a custom style"
											disabled={loading}
											value={answers.customStyle}
											onChange={(e) =>
												onAnswersChange("customStyle", e.target.value)
											}
											className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground transition focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed"
										/>
									)}
								</div>

								{/* Text overlay */}
								<div className="flex flex-col gap-2">
									<label
										htmlFor="textOverlay"
										className="flex items-center gap-2 text-sm font-medium"
									>
										<TypeIcon
											className="h-4 w-4 text-muted-foreground"
											aria-hidden="true"
										/>
										Text overlay (optional)
									</label>
									<input
										id="textOverlay"
										type="text"
										placeholder='e.g., "5 Tips to Speed Up Your PC"'
										disabled={loading}
										value={answers.textOverlay}
										onChange={(e) =>
											onAnswersChange("textOverlay", e.target.value)
										}
										className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground transition focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed"
									/>
								</div>

								{/* Colors / Vibe */}
								<div className="flex flex-col gap-2">
									<label
										htmlFor="vibe"
										className="flex items-center gap-2 text-sm font-medium"
									>
										<Palette
											className="h-4 w-4 text-muted-foreground"
											aria-hidden="true"
										/>
										Colors / Vibe
									</label>
									<select
										id="vibe"
										disabled={loading}
										value={answers.vibe}
										onChange={(e) =>
											onAnswersChange("vibe", e.target.value as Vibe)
										}
										className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground transition focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed"
									>
										{["Bright", "Dark", "Pastel", "Neon", "Custom"].map(
											(opt) => (
												<option
													key={opt}
													value={opt}
												>
													{opt}
												</option>
											)
										)}
									</select>
									{answers.vibe === "Custom" && (
										<input
											type="text"
											placeholder="Describe colors / vibe"
											disabled={loading}
											value={answers.customVibe}
											onChange={(e) =>
												onAnswersChange("customVibe", e.target.value)
											}
											className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground transition focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed"
										/>
									)}
								</div>

								{/* Upload */}
								<div className="flex flex-col gap-2">
									<label
										htmlFor="file"
										className="flex items-center gap-2 text-sm font-medium"
									>
										<ImagePlus
											className="h-4 w-4 text-muted-foreground"
											aria-hidden="true"
										/>
										Optional reference image
									</label>
									<input
										id="file"
										type="file"
										accept="image/*"
										disabled={loading}
										onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
										className="block w-full cursor-pointer rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-muted disabled:cursor-not-allowed"
									/>
									{uploadPreview && (
										<div className="mt-2 flex items-center gap-3">
											{/* <img
                        src={uploadPreview || "/placeholder.svg?height=80&width=144&query=reference%20preview"}
                        alt="Reference preview"
                        className="h-20 w-36 rounded-md border border-border object-contain"
                      /> */}
											<img
												src={
													uploadPreview ||
													"/placeholder.svg?height=80&width=144&query=reference%20preview"
												}
												alt="Reference preview"
												className="rounded-md border border-border object-contain max-w-full h-auto"
											/>

											<button
												type="button"
												onClick={() => onFileChange(null)}
												disabled={loading}
												className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground transition hover:-translate-y-0.5 hover:shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
											>
												<Trash2
													className="h-4 w-4"
													aria-hidden="true"
												/>
												Remove
											</button>
										</div>
									)}
								</div>

								{/* Prompt */}
								<div className="flex flex-col gap-2">
									<label
										htmlFor="prompt"
										className="flex items-center gap-2 text-sm font-medium"
									>
										<Monitor
											className="h-4 w-4 text-muted-foreground"
											aria-hidden="true"
										/>
										Main prompt
									</label>
									<textarea
										id="prompt"
										disabled={loading}
										value={prompt}
										onChange={(e) => {
											setPrompt(e.target.value);
											setPromptTouched(true);
										}}
										placeholder="Describe the thumbnail you want to generate..."
										rows={4}
										className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition focus:-translate-y-0.5 focus:shadow-md focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed"
									/>
									{!promptTouched ? (
										<div className="text-xs text-muted-foreground">
											Prefilled from guided answers. You can edit it anytime.
										</div>
									) : (
										<button
											type="button"
											onClick={() => {
												setPrompt(derivedPrompt);
												setPromptTouched(false);
											}}
											disabled={loading}
											className="w-fit text-left text-xs text-primary underline underline-offset-2 hover:opacity-90 disabled:cursor-not-allowed"
										>
											Sync prompt from answers
										</button>
									)}
								</div>
							</div>

							{/* Actions */}
							<div className="flex items-center gap-3">
								<button
									type="submit"
									disabled={loading}
									className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
									aria-label={primaryButtonLabel}
								>
									{loading ? (
										<>
											<Spinner /> Processing...
										</>
									) : (
										<>
											<Sparkles
												className="h-4 w-4"
												aria-hidden="true"
											/>
											{primaryButtonLabel}
										</>
									)}
								</button>
							</div>
						</form>
					</section>

					{/* RIGHT: Preview + History panel */}
					<section
						aria-labelledby="preview-title"
						className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm"
					>
						<div className="mb-3 flex items-center justify-between">
							<div className="flex items-center gap-2">
								<Monitor
									className="h-5 w-5 text-muted-foreground"
									aria-hidden="true"
								/>
								<h2
									id="preview-title"
									className="text-sm font-semibold"
								>
									Preview
								</h2>
							</div>
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={handleRegenerate}
									disabled={loading || !lastRequestRef.current}
									className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground shadow-sm transition hover:-translate-y-0.5 hover:shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
									aria-label="Regenerate image"
								>
									<RotateCcw
										className="h-4 w-4"
										aria-hidden="true"
									/>
									Regenerate
								</button>
								{imageUrl && (
									<a
										href={imageUrl}
										download={`thumbnail-${Date.now()}.png`}
										className="inline-flex items-center gap-2 rounded-md bg-foreground px-3 py-2 text-xs font-medium text-background shadow-sm transition hover:-translate-y-0.5 hover:shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										aria-label="Download image"
									>
										<DownloadIcon
											className="h-4 w-4"
											aria-hidden="true"
										/>
										Download
									</a>
								)}
							</div>
						</div>

						<div className="min-h-0 flex-1 overflow-auto">
							<div className="rounded-xl border border-border bg-card p-3 shadow-sm">
								{loading ? (
									<ResultSkeleton />
								) : imageUrl ? (
									<div className="space-y-3">
										<img
											src={
												imageUrl ||
												"/placeholder.svg?height=360&width=640&query=generated%20thumbnail"
											}
											alt="Generated thumbnail"
											className="aspect-video w-full rounded-md border border-border object-cover"
										/>
										<div className="text-xs text-muted-foreground">
											<div className="mb-1">
												<span className="font-medium text-foreground">
													Prompt:
												</span>{" "}
												<span className="opacity-90">{prompt}</span>
											</div>
											<div className="opacity-75">
												{formatTimestamp(Date.now())}
											</div>
										</div>
									</div>
								) : (
									<div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-sm text-muted-foreground">
										<div className="aspect-video w-full rounded-md border border-dashed border-border" />
										<p className="mt-3">
											No image yet. Fill the form and{" "}
											{primaryButtonLabel.toLowerCase()}.
										</p>
									</div>
								)}
							</div>

							{/* History */}
							<div className="mt-4">
								<div className="mb-2 flex items-center justify-between">
									<div className="flex items-center gap-2">
										<HistoryIcon
											className="h-4 w-4 text-muted-foreground"
											aria-hidden="true"
										/>
										<h3 className="text-xs font-semibold">History</h3>
									</div>
									<button
										type="button"
										onClick={onClearHistory}
										disabled={loading || history.length === 0}
										className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-[11px] font-medium text-foreground shadow-sm transition hover:-translate-y-0.5 hover:shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
										aria-label="Clear history"
									>
										<Trash2
											className="h-3.5 w-3.5"
											aria-hidden="true"
										/>
										Clear
									</button>
								</div>

								{history.length === 0 ? (
									<p className="text-xs text-muted-foreground">
										Generated thumbnails will appear here.
									</p>
								) : (
									<div
										ref={historyScrollRef}
										className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1"
									>
										{history.map((item, idx) => (
											<button
												key={item.timestamp + "-" + idx}
												type="button"
												onClick={() => onSelectHistory(item)}
												className="w-48 shrink-0 snap-start rounded-lg border border-border bg-card p-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
											>
												<img
													src={
														item.data_url ||
														"/placeholder.svg?height=108&width=192&query=past%20thumbnail"
													}
													alt="Past generated thumbnail"
													className="aspect-video w-full rounded-md border border-border object-cover"
												/>
												<div className="mt-2 space-y-1">
													<div className="truncate text-[11px] text-foreground/80">
														{item.prompt}
													</div>
													<div className="text-[10px] text-muted-foreground">
														{formatTimestamp(item.timestamp)}
													</div>
												</div>
											</button>
										))}
									</div>
								)}
							</div>
						</div>
					</section>
				</div>
			</div>
		</main>
	);
}

function Spinner() {
	return (
		<svg
			className="h-4 w-4 animate-spin text-white"
			viewBox="0 0 24 24"
			aria-hidden="true"
		>
			<circle
				className="opacity-25"
				cx="12"
				cy="12"
				r="10"
				stroke="currentColor"
				strokeWidth="4"
				fill="none"
			/>
			<path
				className="opacity-75"
				fill="currentColor"
				d="M4 12a8 8 0 018-8v4A4 4 0 008 12H4z"
			/>
		</svg>
	);
}

function ResultSkeleton() {
	return (
		<div className="space-y-3">
			<div className="aspect-video w-full animate-pulse rounded-md bg-background" />
			<div className="flex items-center gap-2">
				<div className="h-8 w-28 animate-pulse rounded-md bg-background" />
				<div className="h-8 w-28 animate-pulse rounded-md bg-background" />
			</div>
			<div className="h-4 w-3/4 animate-pulse rounded bg-background" />
			<div className="h-3 w-1/3 animate-pulse rounded bg-background" />
		</div>
	);
}

// Utilities
async function safeReadText(res: Response) {
	try {
		return await res.text();
	} catch {
		return "";
	}
}
function truncate(s: string, n: number) {
	return s.length > n ? s.slice(0, n) + "…" : s;
}

/*
Notes:
- Adjust endpoints /api/generate and /api/edit on your backend as needed.
- Prompt composition follows the spec and always appends the 16:9 high-contrast rule and watermark exclusion.
*/
