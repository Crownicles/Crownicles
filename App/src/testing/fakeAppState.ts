import {useSyncExternalStore} from "react";
import {AppStateRes} from "ws-packets/src/fromServer/appState/AppStateRes";
import type * as AppStateModule from "@/src/store/AppState";

type AppStateHooks = Pick<typeof AppStateModule, "useAppState" | "useAppStateChange">;

function emptyState(): AppStateRes {
	return Object.assign(new AppStateRes(), {seen: [], reveals: []});
}

/**
 * Stands in for the state Core keeps, for screens rendered without a socket: a change applies at
 * once, as the real hook draws it before Core answers.
 *
 * Usage: `jest.mock("@/src/store/AppState", () => require("@/src/testing/fakeAppState").fakeAppState.hooks)`.
 */
class FakeAppState {
	private state = emptyState();

	private readonly listeners = new Set<() => void>();

	public readonly hooks: AppStateHooks = {
		useAppState: () => ({status: "ready", data: useSyncExternalStore(this.subscribe, this.snapshot)}),
		useAppStateChange: () => change => this.set(jest.requireActual<typeof AppStateModule>("@/src/store/AppState").withChange(this.state, change))
	};

	public reset(): void {
		this.set(emptyState());
	}

	private readonly subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return (): void => {
			this.listeners.delete(listener);
		};
	};

	private readonly snapshot = (): AppStateRes => this.state;

	private set(state: AppStateRes): void {
		this.state = state;
		for (const listener of this.listeners) listener();
	}
}

export const fakeAppState = new FakeAppState();
