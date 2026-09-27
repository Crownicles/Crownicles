import {useSyncExternalStore} from "react";
import {PlayerLevelUpRes} from "ws-packets/src/fromServer/character/PlayerLevelUpRes";
import {WebSocketClient} from "@/src/networking/WebSocketClient";

/** The last level the player reached, kept until its toast has been shown; a gain of several levels at once shows the highest. */
class LevelUpStore {
	private latest: PlayerLevelUpRes | null = null;

	private readonly listeners = new Set<() => void>();

	public constructor() {
		WebSocketClient.getInstance().registerPushedPacketHandler<PlayerLevelUpRes>(PlayerLevelUpRes.wireName, packet => {
			if (!packet.self) return;
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

	public readonly getSnapshot = (): PlayerLevelUpRes | null => this.latest;

	public readonly announced = (): void => {
		if (this.latest === null) return;
		this.latest = null;
		this.notify();
	};

	private notify(): void {
		for (const listener of this.listeners) listener();
	}
}

export const levelUpStore = new LevelUpStore();

export function useLevelUp(): PlayerLevelUpRes | null {
	return useSyncExternalStore(levelUpStore.subscribe, levelUpStore.getSnapshot, levelUpStore.getSnapshot);
}
