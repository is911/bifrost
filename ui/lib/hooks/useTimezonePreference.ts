"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "bifrost.timezone";

/** Returns the browser's local IANA timezone (e.g. "America/New_York"). */
function getLocalTimezone(): string {
	return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Returns the full list of IANA timezone identifiers, or a curated fallback. */
export function getSupportedTimezones(): string[] {
	try {
		if (typeof Intl.supportedValuesOf === "function") {
			return Intl.supportedValuesOf("timeZone");
		}
	} catch {
		// Fallback for older runtimes
	}
	return [
		"UTC",
		"America/New_York",
		"America/Chicago",
		"America/Denver",
		"America/Los_Angeles",
		"America/Anchorage",
		"Pacific/Honolulu",
		"Europe/London",
		"Europe/Paris",
		"Europe/Berlin",
		"Asia/Tokyo",
		"Asia/Shanghai",
		"Asia/Kolkata",
		"Asia/Dubai",
		"Australia/Sydney",
		"Pacific/Auckland",
	];
}

/** Validates an IANA timezone string against the supported list. */
function isValidTimezone(tz: string): boolean {
	return getSupportedTimezones().includes(tz);
}

/**
 * Hook that persists the user's preferred timezone in localStorage.
 *
 * Returns a `[timezone, setTimezone]` tuple. Defaults to the browser's
 * local timezone. Invalid stored values are silently replaced with the default.
 *
 * Safe for SSR/Next.js — reads localStorage lazily in an effect to avoid
 * hydration mismatches.
 */
export function useTimezonePreference(): [string, (tz: string) => void] {
	const [timezone, setTimezoneState] = useState<string>(getLocalTimezone);

	// Hydrate from localStorage after mount (client-only).
	useEffect(() => {
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored && isValidTimezone(stored)) {
				setTimezoneState(stored);
			}
		} catch {
			// localStorage unavailable (e.g. SSR, privacy mode) — keep default.
		}
	}, []);

	const setTimezone = useCallback((tz: string) => {
		setTimezoneState(tz);
		try {
			localStorage.setItem(STORAGE_KEY, tz);
		} catch {
			// localStorage unavailable — preference won't persist.
		}
	}, []);

	return [timezone, setTimezone];
}