"use client";

import { createContext, useContext } from "react";

export const OpenUIActionPendingContext = createContext(false);

export function useOpenUIActionPending(): boolean {
	return useContext(OpenUIActionPendingContext);
}
