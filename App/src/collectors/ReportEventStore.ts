import {useSyncExternalStore} from "react";
import {ReportBigEventResultRes} from "ws-packets/src/fromServer/report/ReportBigEventResultRes";
import {WebSocketClient} from "@/src/networking/WebSocketClient";

type Listener = () => void;

/**
 * Keeps the last big-event outcome until the player has read it. The result follows the collector
 * stop packet, so it cannot live in the collector itself.
 */
class ReportEventStore {
	private outcome: ReportBigEventResultRes | null = null;

	private readonly listeners = new Set<Listener>();

	public constructor() {
		WebSocketClient.getInstance().registerPushedPacketHandler(ReportBigEventResultRes.name, this.setOutcome);
	}

	public readonly subscribe = (listener: Listener): (() => void) => {
		this.listeners.add(listener);
		return (): void => {
			this.listeners.delete(listener);
		};
	};

	public readonly getSnapshot = (): ReportBigEventResultRes | null => this.outcome;

	public readonly clear = (): void => {
		if (this.outcome === null) {
			return;
		}
		this.outcome = null;
		this.notify();
	};

	private readonly setOutcome = (outcome: ReportBigEventResultRes): void => {
		this.outcome = outcome;
		this.notify();
	};

	private notify(): void {
		for (const listener of this.listeners) {
			listener();
		}
	}
}

export const reportEventStore = new ReportEventStore();

export function useBigEventOutcome(): ReportBigEventResultRes | null {
	return useSyncExternalStore(reportEventStore.subscribe, reportEventStore.getSnapshot, reportEventStore.getSnapshot);
}
