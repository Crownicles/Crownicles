import {useEffect, useSyncExternalStore} from "react";
import {getItem, setItem} from "expo-secure-store";
import {usePlayerProfile} from "@/src/store/usePlayerProfile";

/** The moments of the contest the guide stages once per character, then never again. */
export const ONBOARDING_MOMENTS = {
	/** The guide has shown how a token buys time on the road. */
	TOKENS: "tokens",

	/** The guide has explained why a mishap holds the traveller back. */
	OCCUPIED: "occupied",

	/** The player chose how to go on once the long road to the first city began. */
	FORK: "fork",

	/** The character was seen running the contest on this device, so its end deserves the royal seal. */
	CONTEST_JOINED: "contestJoined",

	/** The royal seal closing the contest was shown. */
	ROYAL_SEAL: "royalSeal"
} as const;
export type OnboardingMoment = typeof ONBOARDING_MOMENTS[keyof typeof ONBOARDING_MOMENTS];

const KEY_PREFIX = "onboarding_";

function isMoment(value: unknown): value is OnboardingMoment {
	return Object.values(ONBOARDING_MOMENTS).some(moment => moment === value);
}

/** Secure store keys only accept a few characters, and a pseudo may hold any. */
function storageKey(account: string): string {
	return `${KEY_PREFIX}${account.replace(/[^A-Za-z0-9._-]/g, "_")}`;
}

function read(account: string): readonly OnboardingMoment[] {
	try {
		const stored = getItem(storageKey(account));
		const parsed: unknown = stored === null ? [] : JSON.parse(stored);
		return Array.isArray(parsed) ? parsed.filter(isMoment) : [];
	}
	catch {
		return [];
	}
}

export type OnboardingSnapshot = {account: string; seen: readonly OnboardingMoment[]} | null;

class OnboardingStore {
	private snapshot: OnboardingSnapshot = null;

	private readonly listeners = new Set<() => void>();

	public readonly subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return (): void => {
			this.listeners.delete(listener);
		};
	};

	public readonly getSnapshot = (): OnboardingSnapshot => this.snapshot;

	public load(account: string): void {
		if (this.snapshot?.account === account) return;
		this.snapshot = {account, seen: read(account)};
		this.emit();
	}

	public mark(moment: OnboardingMoment): void {
		if (!this.snapshot || this.snapshot.seen.includes(moment)) return;
		this.snapshot = {account: this.snapshot.account, seen: [...this.snapshot.seen, moment]};
		try {
			setItem(storageKey(this.snapshot.account), JSON.stringify(this.snapshot.seen));
		}
		catch (error) {
			console.error("Failed to save the onboarding:", error);
		}
		this.emit();
	}

	private emit(): void {
		for (const listener of this.listeners) listener();
	}
}

export const onboardingStore = new OnboardingStore();

export type OnboardingMoments = {
	/** Unknown until the character's record is read: nothing is staged before. */
	ready: boolean;
	seen: (moment: OnboardingMoment) => boolean;
	mark: (moment: OnboardingMoment) => void;
};

export function useOnboardingMoments(): OnboardingMoments {
	const snapshot = useSyncExternalStore(onboardingStore.subscribe, onboardingStore.getSnapshot, onboardingStore.getSnapshot);
	return {
		ready: snapshot !== null,
		seen: moment => snapshot?.seen.includes(moment) ?? true,
		mark: moment => onboardingStore.mark(moment)
	};
}

/** Opens the record of the character the profile names, once it names one. */
export function useOnboardingAccount(): void {
	const profile = usePlayerProfile();
	const account = profile.status === "ready" ? profile.data.pseudo : null;
	useEffect(() => {
		if (account) onboardingStore.load(account);
	}, [account]);
}
