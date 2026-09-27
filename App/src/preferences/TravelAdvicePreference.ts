import {useSyncExternalStore} from "react";
import {getItem, setItem} from "expo-secure-store";

const STORAGE_KEY = "travelAdvices";
const HIDDEN = "hidden";
const SHOWN = "shown";

/** Whether the adventure screen shows the traveller's advices; a device setting, like the theme. */
class TravelAdvicePreference {
	private shown: boolean | undefined;

	private readonly listeners = new Set<() => void>();

	public readonly subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return (): void => {
			this.listeners.delete(listener);
		};
	};

	public readonly getSnapshot = (): boolean => {
		if (this.shown === undefined) {
			try {
				this.shown = getItem(STORAGE_KEY) !== HIDDEN;
			}
			catch {
				this.shown = true;
			}
		}
		return this.shown;
	};

	public readonly set = (shown: boolean): void => {
		this.shown = shown;
		setItem(STORAGE_KEY, shown ? SHOWN : HIDDEN);
		for (const listener of this.listeners) listener();
	};
}

export const travelAdvicePreference = new TravelAdvicePreference();

export function useTravelAdvicesShown(): boolean {
	return useSyncExternalStore(travelAdvicePreference.subscribe, travelAdvicePreference.getSnapshot, travelAdvicePreference.getSnapshot);
}
