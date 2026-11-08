import { useSyncExternalStore } from "react";
import { FromServerPacket } from "ws-packets/src/fromServer/FromServerPacket";
import { WebSocketClient } from "@/src/networking/WebSocketClient";

/** The last packet of a kind Core pushed on its own, or the ones it merges, kept until the toast announcing it has been shown. */
export class PushedAnnouncementStore<Packet extends FromServerPacket> {
	private latest: Packet | null = null;

	private readonly listeners = new Set<() => void>();

	/**
	 * @param wireName The pushed packet to keep
	 * @param concerns Whether a packet is worth announcing to this player; every one is, without it
	 * @param merge Folds a packet into the one still waiting to be announced; without it, the newer one replaces it
	 */
	public constructor(wireName: string, concerns?: (packet: Packet) => boolean, merge?: (pending: Packet, next: Packet) => Packet) {
		WebSocketClient.getInstance().registerPushedPacketHandler<Packet>(wireName, packet => {
			if (concerns && !concerns(packet)) {
				return;
			}
			this.latest = this.latest && merge ? merge(this.latest, packet) : packet;
			this.notify();
		});
	}

	public readonly subscribe = (listener: () => void): () => void => {
		this.listeners.add(listener);
		return (): void => {
			this.listeners.delete(listener);
		};
	};

	public readonly getSnapshot = (): Packet | null => this.latest;

	public readonly announced = (): void => {
		if (this.latest === null) {
			return;
		}
		this.latest = null;
		this.notify();
	};

	private notify(): void {
		for (const listener of this.listeners) {
			listener();
		}
	}
}

export function usePushedAnnouncement<Packet extends FromServerPacket>(store: PushedAnnouncementStore<Packet>): Packet | null {
	return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
