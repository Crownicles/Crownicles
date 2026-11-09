import { useSyncExternalStore } from "react";
import {
	getItem, setItem
} from "expo-secure-store";

/** A choice kept on this device only, read synchronously so the first frame already follows it. */
export class DevicePreference<Value extends string> {
	private value: Value | undefined;

	private readonly listeners = new Set<() => void>();

	public constructor(private readonly storageKey: string, private readonly values: readonly Value[], private readonly fallback: Value) {}

	public readonly subscribe = (listener: () => void): () => void => {
		this.listeners.add(listener);
		return (): void => {
			this.listeners.delete(listener);
		};
	};

	public readonly getSnapshot = (): Value => {
		if (this.value === undefined) {
			try {
				const stored = getItem(this.storageKey);
				this.value = this.values.find(value => value === stored) ?? this.fallback;
			}
			catch {
				this.value = this.fallback;
			}
		}
		return this.value;
	};

	public readonly set = (value: Value): void => {
		this.value = value;
		setItem(this.storageKey, value);
		for (const listener of this.listeners) {
			listener();
		}
	};
}

export function useDevicePreference<Value extends string>(preference: DevicePreference<Value>): Value {
	return useSyncExternalStore(preference.subscribe, preference.getSnapshot, preference.getSnapshot);
}
