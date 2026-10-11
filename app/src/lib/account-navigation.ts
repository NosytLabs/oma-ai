/** One account workspace, including compatibility for older settings links. */
export type SettingsSection = "profile" | "appearance" | "sessions" | "danger";

export function settingsSection(raw: string | null | undefined): SettingsSection {
	if (raw === "theme" || raw === "appearance") return "appearance";
	if (raw === "sessions") return "sessions";
	if (raw === "privacy" || raw === "data" || raw === "danger") return "danger";
	return "profile";
}

export function accountSettingsHref(section: string = "profile", search?: { toString(): string } | null): string {
	const params = new URLSearchParams(search?.toString());
	params.set("tab", "settings");
	params.set("section", settingsSection(section));
	return `/dashboard?${params.toString()}`;
}

export function legacySettingsHref(search: { toString(): string }, hash = ""): string {
	const params = new URLSearchParams(search.toString());
	const tab = params.get("tab");
	if (tab === "keys" || tab === "api-keys") {
		params.set("tab", "api-keys");
		params.delete("section");
		return `/dashboard?${params.toString()}`;
	}
	return accountSettingsHref(params.get("section") ?? tab ?? hash.replace(/^#/, ""), params);
}
