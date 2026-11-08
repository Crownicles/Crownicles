import { useSyncExternalStore } from "react";
import { Platform } from "react-native";
import {
	getItem, setItem
} from "expo-secure-store";
import {
	nativeApplicationVersion, nativeBuildVersion
} from "expo-application";
import Constants from "expo-constants";

/** The last JavaScript error that stopped the app, kept on the device for the player to hand over. */
export type FatalErrorRecord = {
	message: string;
	stack: string;

	/** The components being drawn, when the error broke a screen rather than a callback. */
	componentStack?: string;
	occurredAt: number;
	appVersion: string;
	appBuild?: string;
	platform: string;
};

type Listener = () => void;

const STORAGE_KEY = "lastFatalError";

/** Long enough for the frames that locate the error, short enough to be stored and shared as a message. */
const MAX_TRACE_LENGTH = 4_000;

function trace(value: unknown): string {
	return typeof value === "string" ? value.slice(0, MAX_TRACE_LENGTH) : "";
}

/** What the error says and where it was thrown; a thrown value that is no Error only has its text. */
export function describeFatalError(error: unknown): Pick<FatalErrorRecord, "message" | "stack" | "componentStack"> {
	if (!(error instanceof Error)) {
		return {
			message: String(error), stack: ""
		};
	}
	const componentStack = trace(Reflect.get(error, "componentStack"));
	return {
		message: `${error.name}: ${error.message}`,
		stack: trace(error.stack),
		...componentStack ? { componentStack } : {}
	};
}

function buildRecord(error: unknown): FatalErrorRecord {
	return {
		...describeFatalError(error),
		occurredAt: Date.now(),
		appVersion: nativeApplicationVersion ?? Constants.expoConfig?.version ?? "",
		...nativeBuildVersion ? { appBuild: nativeBuildVersion } : {},
		platform: `${Platform.OS} ${Platform.Version}`
	};
}

function storedRecord(): FatalErrorRecord | null {
	try {
		const stored = getItem(STORAGE_KEY);
		return stored ? JSON.parse(stored) as FatalErrorRecord : null;
	}
	catch {
		return null;
	}
}

class FatalErrorStore {
	private last: FatalErrorRecord | null | undefined;

	private recorded: unknown;

	private raised: Error | null = null;

	private readonly listeners = new Set<Listener>();

	private readonly relays = new Set<Listener>();

	/**
	 * Written synchronously: a fatal error is followed by the end of the process, which an asynchronous write would not survive.
	 * The error a screen was handed is already kept: showing it does not record it again.
	 */
	public readonly record = (error: unknown): void => {
		if (error === this.recorded || error === this.raised) {
			return;
		}
		this.recorded = error;
		const record = buildRecord(error);
		this.last = record;
		try {
			setItem(STORAGE_KEY, JSON.stringify(record));
		}
		catch (storageError) {
			console.warn("Unable to keep the fatal error report:", storageError);
		}
		for (const listener of this.listeners) {
			listener();
		}
	};

	public readonly getLast = (): FatalErrorRecord | null => {
		if (this.last === undefined) {
			this.last = storedRecord();
		}
		return this.last;
	};

	public readonly subscribe = (listener: Listener): () => void => {
		this.listeners.add(listener);
		return (): void => {
			this.listeners.delete(listener);
		};
	};

	/** Hands an error thrown outside any screen to the one that can show it; false when none is there to take it. */
	public readonly raise = (error: unknown): boolean => {
		if (this.relays.size === 0) {
			return false;
		}
		this.raised = error instanceof Error ? error : new Error(String(error));
		for (const relay of this.relays) {
			relay();
		}
		return true;
	};

	public readonly getRaised = (): Error | null => this.raised;

	public readonly subscribeRaised = (relay: Listener): () => void => {
		this.relays.add(relay);
		return (): void => {
			this.relays.delete(relay);
		};
	};

	public readonly dismissRaised = (): void => {
		this.raised = null;
	};
}

export const fatalErrorStore = new FatalErrorStore();

export function useLastFatalError(): FatalErrorRecord | null {
	return useSyncExternalStore(fatalErrorStore.subscribe, fatalErrorStore.getLast, fatalErrorStore.getLast);
}

let installed = false;

/**
 * React Native ends the app on an error thrown outside rendering (a timer, a gesture, an animation). Its message and stack are
 * kept first; then, in a release build, the error screen takes it instead, unless no screen is mounted yet to show it.
 * A development build keeps its own red screen.
 */
export function installFatalErrorHandler(): void {
	// The web preview runs without React Native's error handler: the browser keeps its own.
	if (installed || typeof ErrorUtils === "undefined") {
		return;
	}
	installed = true;
	const reactNativeHandler = ErrorUtils.getGlobalHandler();
	ErrorUtils.setGlobalHandler((error: unknown, isFatal?: boolean): void => {
		if (isFatal) {
			fatalErrorStore.record(error);
			if (!__DEV__ && fatalErrorStore.raise(error)) {
				return;
			}
		}
		reactNativeHandler(error, isFatal);
	});
}
