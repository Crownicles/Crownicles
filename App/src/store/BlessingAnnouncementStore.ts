import {useSyncExternalStore} from "react";
import {BlessingActivatedRes} from "ws-packets/src/fromServer/character/BlessingActivatedRes";
import {WebSocketClient} from "@/src/networking/WebSocketClient";

/** The blessing just invoked for everyone, kept until its notification has been shown. */
class BlessingAnnouncementStore {
	private latest: BlessingActivatedRes | null = null;

	private readonly listeners = new Set<() => void>();

	public constructor() {
		WebSocketClient.getInstance().registerPushedPacketHandler<BlessingActivatedRes>(BlessingActivatedRes.wireName, packet => {
			this.latest = packet;
			this.notify();
		});
	}

	public readonly subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return (): void => {
			this.listeners.delete(listener);
		};
	};

	public readonly getSnapshot = (): BlessingActivatedRes | null => this.latest;

	public readonly announced = (): void => {
		if (this.latest === null) return;
		this.latest = null;
		this.notify();
	};

	private notify(): void {
		for (const listener of this.listeners) listener();
	}
}

export const blessingAnnouncementStore = new BlessingAnnouncementStore();

export function useBlessingAnnouncement(): BlessingActivatedRes | null {
	return useSyncExternalStore(blessingAnnouncementStore.subscribe, blessingAnnouncementStore.getSnapshot, blessingAnnouncementStore.getSnapshot);
}
