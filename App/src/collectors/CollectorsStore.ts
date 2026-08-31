import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {ReactionCollectorStop, COLLECTOR_STOP_REASONS} from "ws-packets/src/fromServer/common/ReactionCollectorStop";
import {ReactionCollectorReactReq} from "ws-packets/src/fromClient/ReactionCollectorReactReq";
import {CommandGetCurrentReactionCollectorsReq} from "ws-packets/src/fromClient/GetCurrentReactionCollectorsReq";
import {CommandGetCurrentReactionCollectorsRes} from "ws-packets/src/fromServer/getCurrentReactionCollectors/GetCurrentReactionCollectorsRes";
import {CITY_DATA_KINDS, ReactionCollectorDataKind} from "ws-packets/src/fromServer/collectors";
import {ReportStayInCity} from "ws-packets/src/fromServer/report/ReportStayInCity";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {AppConstants} from "@/src/AppConstants";
import {WebSocketClient} from "@/src/networking/WebSocketClient";

type StoreListener = () => void;
type ResolutionListener = (kind: ReactionCollectorDataKind) => void;

class CollectorsStore {
	private readonly open = new Map<string, ReactionCollectorCreation>();

	private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

	private readonly answeredKinds = new Map<string, ReactionCollectorDataKind>();

	private readonly answering = new Set<string>();

	private readonly listeners = new Set<StoreListener>();

	private readonly resolutionListeners = new Set<ResolutionListener>();

	private snapshot: ReactionCollectorCreation[] = [];

	public constructor() {
		const client = WebSocketClient.getInstance();
		client.registerPushedPacketHandler(ReactionCollectorCreation.name, this.track);
		client.registerPushedPacketHandler(ReactionCollectorStop.name, this.stop);
		client.registerPushedPacketHandler(ReportStayInCity.name, this.stayInCity);
	}

	public readonly subscribe = (listener: StoreListener): (() => void) => {
		this.listeners.add(listener);
		return (): void => {
			this.listeners.delete(listener);
		};
	};

	public readonly getSnapshot = (): ReactionCollectorCreation[] => this.snapshot;

	public readonly subscribeToResolution = (listener: ResolutionListener): (() => void) => {
		this.resolutionListeners.add(listener);
		return (): void => {
			this.resolutionListeners.delete(listener);
		};
	};

	public readonly isAnswerPending = (collectorId: string): boolean => this.answering.has(collectorId);

	/**
	 * Rehydrates collectors that were created while the app was backgrounded or reconnecting.
	 * Pushed packets are not replayed by the websocket server, so relying on them alone leaves the
	 * adventure tab empty even though the player is still in a city (or has a pending event).
	 */
	public readonly syncCurrent = (): void => {
		WebSocketClient.getInstance().sendPacket(
			makeFromClientPacket(CommandGetCurrentReactionCollectorsReq, {}),
			{
				[CommandGetCurrentReactionCollectorsRes.name]: (packet: CommandGetCurrentReactionCollectorsRes): void => {
					for (const collector of packet.collectors) {
						this.track(collector);
					}
				}
			},
			{time: AppConstants.PACKET_TIMEOUT}
		);
	};

	public readonly track = (collector: ReactionCollectorCreation): void => {
		if (this.open.has(collector.id)) {
			return;
		}

		this.open.set(collector.id, collector);
		this.snapshot = [...this.open.values()];
		this.notifyListeners();

		const timer = setTimeout((): void => {
			this.expireLocally(collector.id);
		}, Math.max(0, collector.endTime - Date.now()));
		this.timers.set(collector.id, timer);
	};

	public readonly removeExpired = (now: number = Date.now()): void => {
		for (const [collectorId, collector] of this.open) {
			if (collector.endTime <= now) {
				this.expireLocally(collectorId);
			}
		}
	};

	public readonly react = (collectorId: string, reactionIndex: number): void => {
		const collector = this.open.get(collectorId);
		if (!collector || this.answering.has(collectorId)) {
			return;
		}
		this.answering.add(collectorId);
		this.answeredKinds.set(collectorId, collector.data.type);
		this.snapshot = [...this.open.values()];
		this.notifyListeners();
		WebSocketClient.getInstance().sendPacket(makeFromClientPacket(ReactionCollectorReactReq, {
			collectorId,
			reactionIndex
		}), {});
	};

	private readonly stop = (packet: ReactionCollectorStop): void => {
		this.forget(packet.collectorId);
		const answeredKind = this.answeredKinds.get(packet.collectorId);
		this.answeredKinds.delete(packet.collectorId);
		if (answeredKind && packet.reason === COLLECTOR_STOP_REASONS.RESOLVED) {
			this.notifyResolution(answeredKind);
		}
	};

	/**
	 * The server sends this after a city collector times out (or when a destination choice defaults
	 * to staying put). It has no UI of its own; it simply tells the app to refresh the report while
	 * the player remains in the city.
	 */
	private readonly stayInCity = (): void => {
		this.notifyResolution(CITY_DATA_KINDS.CITY);
	};

	private readonly expireLocally = (collectorId: string): void => {
		const collector = this.open.get(collectorId);
		if (!collector) {
			return;
		}
		this.answeredKinds.delete(collectorId);
		this.forget(collectorId);
		// This is a fallback for a backgrounded/offline app. A server stop packet may still follow;
		// invalidating the same queries twice is harmless and keeps the report from getting stuck.
		this.notifyResolution(collector.data.type);
	};

	private readonly forget = (collectorId: string): void => {
		this.answering.delete(collectorId);
		const timer = this.timers.get(collectorId);
		if (timer) {
			clearTimeout(timer);
			this.timers.delete(collectorId);
		}
		if (!this.open.delete(collectorId)) {
			return;
		}
		this.snapshot = [...this.open.values()];
		this.notifyListeners();
	};

	private readonly notifyListeners = (): void => {
		for (const listener of this.listeners) {
			listener();
		}
	};

	private readonly notifyResolution = (kind: ReactionCollectorDataKind): void => {
		for (const listener of this.resolutionListeners) {
			listener(kind);
		}
	};
}

export const collectorsStore = new CollectorsStore();
