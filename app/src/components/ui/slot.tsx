import { forwardRef, type HTMLAttributes } from "react";

/**
 * Slot — minimal Radix-Slot-equivalent for the `asChild` pattern.
 * Merges its props into the immediate child element via cloneElement.
 * Used by Button when asChild is true so callers can render <Link>,
 * <a>, or any element with the button styling applied.
 */
import { cloneElement, isValidElement } from "react";
import type { ReactElement, ReactNode, Ref } from "react";

export interface SlotProps extends HTMLAttributes<HTMLElement> {
	children?: ReactNode;
	ref?: Ref<HTMLElement>;
}

export const Slot = forwardRef<HTMLElement, SlotProps>(function Slot(
	{ children, ...slotProps },
	forwardedRef,
) {
	if (!isValidElement(children)) {
		return null;
	}

	const child = children as ReactElement<{
		className?: string;
		style?: React.CSSProperties;
		ref?: Ref<HTMLElement>;
	}>;

	const childProps = child.props;
	const mergedProps: Record<string, unknown> = { ...slotProps };

	if (slotProps.className || childProps.className) {
		mergedProps.className = cn(slotProps.className, childProps.className);
	}

	if (slotProps.style || childProps.style) {
		mergedProps.style = {
			...((slotProps.style as React.CSSProperties) ?? {}),
			...((childProps.style as React.CSSProperties) ?? {}),
		};
	}

	mergedProps.ref = mergeRefs(forwardedRef, childProps.ref);

	return cloneElement(child, mergedProps);
});

function cn(...classes: Array<string | undefined>): string {
	return classes.filter(Boolean).join(" ");
}

function mergeRefs<T>(...refs: Array<Ref<T> | undefined>): Ref<T> {
	return (node: T | null) => {
		for (const ref of refs) {
			if (typeof ref === "function") {
				ref(node);
			} else if (ref != null) {
				(ref as { current: T | null }).current = node;
			}
		}
	};
}