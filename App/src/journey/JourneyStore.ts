import {getItem, setItem} from "expo-secure-store";
import {AppStateFlag} from "ws-packets/src/objects/AppState";
import {isJourneyTab, JOURNEY_FEATURES, JourneyFeature, JourneyTab} from "@/src/journey/Journey";

/** Which unlocks the player has already been shown, and which tabs they have opened since. */
export type JourneyRecord = {announced: readonly JourneyFeature[]; visited: readonly JourneyFeature[]};

const RECORDED: AppStateFlag = "journeyRecorded";
const LAST_TABS_KEY = "journeyLastTabs";

export function announcedFlag(feature: JourneyFeature): AppStateFlag {
	return `announced.${feature}`;
}

export function visitedFlag(feature: JourneyFeature): AppStateFlag {
	return `visited.${feature}`;
}

/** The record Core keeps on the character; none until the app has written the first one. */
export function journeyRecordOf(seen: readonly AppStateFlag[]): JourneyRecord | null {
	if (!seen.includes(RECORDED)) return null;
	const features = Object.values(JOURNEY_FEATURES);
	return {
		announced: features.filter(feature => seen.includes(announcedFlag(feature))),
		visited: features.filter(feature => seen.includes(visitedFlag(feature)))
	};
}

/**
 * The first record of a character. One met after it set off, on Discord, has already found what it
 * unlocked: only what opens from now on is announced. A newcomer discovers everything.
 */
export function firstRecord(newcomer: boolean, unlocked: readonly JourneyFeature[]): AppStateFlag[] {
	return [RECORDED, ...newcomer ? [] : unlocked.flatMap(feature => [announcedFlag(feature), visitedFlag(feature)])];
}

/** What the device remembers of the journey: nothing that belongs to the character, which Core keeps. */
class JourneyStore {
	/** Seen during this launch before the first report: this character discovers everything from the start. */
	private newcomer = false;

	/** Read once from the device, then kept in step with what is saved. */
	private knownTabs: readonly JourneyTab[] | null | undefined;

	public markNewcomer(): void {
		this.newcomer = true;
	}

	public isNewcomer(): boolean {
		return this.newcomer;
	}

	/** The tabs of the last known character, drawn while its state loads so that they do not pop in. */
	public lastTabs(): readonly JourneyTab[] | null {
		if (this.knownTabs === undefined) {
			try {
				const stored: unknown = JSON.parse(getItem(LAST_TABS_KEY) ?? "null");
				this.knownTabs = Array.isArray(stored) ? stored.filter(isJourneyTab) : null;
			}
			catch {
				this.knownTabs = null;
			}
		}
		return this.knownTabs;
	}

	public saveLastTabs(tabs: readonly JourneyTab[]): void {
		if (this.knownTabs?.join() === tabs.join()) return;
		this.knownTabs = tabs;
		try {
			setItem(LAST_TABS_KEY, JSON.stringify(tabs));
		}
		catch (error) {
			console.error("Failed to save the last tabs:", error);
		}
	}
}

export const journeyStore = new JourneyStore();
