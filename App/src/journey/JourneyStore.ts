import {getItem, setItem} from "expo-secure-store";
import {isJourneyTab, JOURNEY_FEATURES, JourneyFeature, JourneyTab} from "@/src/journey/Journey";

/** Which unlocks the player has already been shown, and which tabs they have opened since. */
export type JourneyRecord = {announced: readonly JourneyFeature[]; visited: readonly JourneyFeature[]};

const RECORD_KEY_PREFIX = "journey_";
const LAST_TABS_KEY = "journeyLastTabs";
const EMPTY_RECORD: JourneyRecord = {announced: [], visited: []};

function isFeature(value: unknown): value is JourneyFeature {
	return Object.values(JOURNEY_FEATURES).some(feature => feature === value);
}

/** Secure store keys only accept a few characters, and a pseudo may hold any. */
function recordKey(account: string): string {
	return `${RECORD_KEY_PREFIX}${account.replace(/[^A-Za-z0-9._-]/g, "_")}`;
}

function readJson(key: string): unknown {
	try {
		const stored = getItem(key);
		return stored === null ? null : JSON.parse(stored);
	}
	catch {
		return null;
	}
}

function write(key: string, value: unknown): void {
	try {
		setItem(key, JSON.stringify(value));
	}
	catch (error) {
		console.error("Failed to save the journey:", error);
	}
}

function parseRecord(value: unknown): JourneyRecord | null {
	if (typeof value !== "object" || value === null) return null;
	const {announced, visited} = value as Partial<Record<keyof JourneyRecord, unknown>>;
	if (!Array.isArray(announced) || !Array.isArray(visited)) return null;
	return {announced: announced.filter(isFeature), visited: visited.filter(isFeature)};
}

function including(features: readonly JourneyFeature[], added: readonly JourneyFeature[]): readonly JourneyFeature[] {
	return [...new Set([...features, ...added])];
}

class JourneyStore {
	private current: {account: string; record: JourneyRecord} | null = null;

	/** Seen during this launch before the first report: this character discovers everything from the start. */
	private newcomer = false;

	/** Read once from the device, then kept in step with what is saved. */
	private knownTabs: readonly JourneyTab[] | null | undefined;

	private readonly listeners = new Set<() => void>();

	public readonly subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return (): void => {
			this.listeners.delete(listener);
		};
	};

	public readonly getSnapshot = (): JourneyRecord | null => this.current?.record ?? null;

	public markNewcomer(): void {
		this.newcomer = true;
	}

	/**
	 * Opens the account's record. A character met for the first time after it set off, on Discord or
	 * on another phone, has already found what it unlocked: only what opens from now on is announced.
	 */
	public load(account: string, unlocked: readonly JourneyFeature[]): void {
		if (this.current?.account === account) return;
		const stored = parseRecord(readJson(recordKey(account)));
		const record = stored ?? (this.newcomer ? EMPTY_RECORD : {announced: unlocked, visited: unlocked});
		this.current = {account, record};
		if (!stored) write(recordKey(account), record);
		this.emit();
	}

	public announce(feature: JourneyFeature): void {
		this.update(record => ({...record, announced: including(record.announced, [feature])}));
	}

	public visit(features: readonly JourneyFeature[]): void {
		this.update(record => ({announced: including(record.announced, features), visited: including(record.visited, features)}));
	}

	/** The tabs of the last known character, drawn while its profile loads so that they do not pop in. */
	public lastTabs(): readonly JourneyTab[] | null {
		if (this.knownTabs === undefined) {
			const stored = readJson(LAST_TABS_KEY);
			this.knownTabs = Array.isArray(stored) ? stored.filter(isJourneyTab) : null;
		}
		return this.knownTabs;
	}

	public saveLastTabs(tabs: readonly JourneyTab[]): void {
		if (this.knownTabs?.join() === tabs.join()) return;
		this.knownTabs = tabs;
		write(LAST_TABS_KEY, tabs);
	}

	private update(change: (record: JourneyRecord) => JourneyRecord): void {
		if (!this.current) return;
		const record = change(this.current.record);
		if (record.announced.length === this.current.record.announced.length && record.visited.length === this.current.record.visited.length) return;
		this.current = {account: this.current.account, record};
		write(recordKey(this.current.account), record);
		this.emit();
	}

	private emit(): void {
		for (const listener of this.listeners) listener();
	}
}

export const journeyStore = new JourneyStore();
