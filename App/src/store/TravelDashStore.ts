import {useSyncExternalStore} from "react";

type Listener = () => void;

/** The runner's dash to the next stop once tokens are spent: long enough to be seen, short enough not to be waited for. */
export const TRAVEL_DASH_MS = 1_100;

let dashing = false;
const listeners = new Set<Listener>();

/** Whether the runner is dashing to the next stop, so what follows the road can race along with it. */
export const travelDashStore = {
	set(value: boolean): void {
		if (dashing === value) return;
		dashing = value;
		listeners.forEach(listener => listener());
	},
	subscribe(listener: Listener): () => void {
		listeners.add(listener);
		return (): void => {
			listeners.delete(listener);
		};
	},
	getSnapshot(): boolean {
		return dashing;
	}
};

export function useTravelDashing(): boolean {
	return useSyncExternalStore(travelDashStore.subscribe, travelDashStore.getSnapshot, travelDashStore.getSnapshot);
}
