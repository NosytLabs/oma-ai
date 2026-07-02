/**
 * Barrel export for the auth component primitives.
 *
 * Pages should import from this file, not the individual modules — keeps
 * refactors local and lets us add new primitives without touching
 * every callsite.
 */
export { AuthError, shapeAuthError } from "./AuthError";
export { AuthSkeleton } from "./AuthSkeleton";
export { SiwePreview } from "./SiwePreview";
export type {
	AuthErrorKind,
	AuthErrorShape,
	ConnectorKind,
	ConnectorView,
} from "./types";
export { WalletPicker } from "./WalletPicker";
export { WalletStatus } from "./WalletStatus";
