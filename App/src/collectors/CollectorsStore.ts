import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {ReactionCollectorStop, COLLECTOR_STOP_REASONS} from "ws-packets/src/fromServer/common/ReactionCollectorStop";
import {ReactionCollectorEnded} from "ws-packets/src/fromServer/common/ReactionCollectorEnded";
import {ReactionCollectorReactReq} from "ws-packets/src/fromClient/ReactionCollectorReactReq";
import {CommandGetCurrentReactionCollectorsReq} from "ws-packets/src/fromClient/GetCurrentReactionCollectorsReq";
import {CommandGetCurrentReactionCollectorsRes} from "ws-packets/src/fromServer/getCurrentReactionCollectors/GetCurrentReactionCollectorsRes";
import {CITY_DATA_KINDS, ReactionCollectorDataKind} from "ws-packets/src/fromServer/collectors";
import {ReportStayInCity} from "ws-packets/src/fromServer/report/ReportStayInCity";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {AppConstants} from "@/src/AppConstants";
import {WebSocketClient} from "@/src/networking/WebSocketClient";

/** The server-issued identifier a collector is answered and stopped by. */
type CollectorId = ReactionCollectorCreation["id"];

type StoreListener = () => void;
type ResolutionListener = (kind: ReactionCollectorDataKind) => void;

class CollectorsStore {
	private readonly open = new Map<string, ReactionCollectorCreation>();

	private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

	private readonly answeredKinds = new Map<string, ReactionCollectorDataKind>();

	private readonly answering = new Set<string>();

	/** Collectors a screen answered on the player's behalf: they must never reach the screen. */
	private readonly hidden = new Set<string>();

	/** Collectors the server already stopped: a deferred track landing after the stop must not bring them back. */
	private readonly finished = new Set<string>();

	private readonly listeners = new Set<StoreListener>();

	private readonly resolutionListeners = new Set<ResolutionListener>();

	private snapshot: ReactionCollectorCreation[] = [];

	public constructor() {
		const client = WebSocketClient.getInstance();
		client.registerPushedPacketHandler(ReactionCollectorCreation.wireName, this.trackPushed);
		client.registerPushedPacketHandler(ReactionCollectorStop.wireName, this.stop);
		client.registerPushedPacketHandler(ReportStayInCity.wireName, this.stayInCity);
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

	public readonly isAnswerPending = (collectorId: CollectorId): boolean => this.answering.has(collectorId);

	public readonly reset = (): void => {
		for (const timer of this.timers.values()) {
			clearTimeout(timer);
		}
		this.open.clear();
		this.timers.clear();
		this.answeredKinds.clear();
		this.answering.clear();
		this.hidden.clear();
		this.finished.clear();
		this.snapshot = [];
		this.notifyListeners();
	};

	/**
	 * Rehydrates collectors that were created while the app was backgrounded or reconnecting.
	 * Pushed packets are not replayed by the websocket server, so relying on them alone leaves the
	 * adventure tab empty even though the player is still in a city (or has a pending event).
	 */
	public readonly syncCurrent = (): void => {
		WebSocketClient.getInstance().sendPacket(
			makeFromClientPacket(CommandGetCurrentReactionCollectorsReq, {}),
			{
				[CommandGetCurrentReactionCollectorsRes.wireName]: (packet: CommandGetCurrentReactionCollectorsRes): void => {
					for (const collector of packet.collectors) {
						this.track(collector);
					}
				}
			},
			{time: AppConstants.PACKET_TIMEOUT}
		);
	};

	public readonly track = (collector: ReactionCollectorCreation): void => {
		if (this.isKnown(collector.id)) {
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

	private readonly isKnown = (collectorId: CollectorId): boolean =>
		this.open.has(collectorId) || this.hidden.has(collectorId) || this.finished.has(collectorId);

	public readonly removeExpired = (now: number = Date.now()): void => {
		for (const [collectorId, collector] of this.open) {
			if (collector.endTime <= now) {
				this.expireLocally(collectorId);
			}
		}
	};

	public readonly react = (collectorId: CollectorId, reactionIndex: number): void => {
		const collector = this.open.get(collectorId);
		if (!collector || this.answering.has(collectorId)) {
			return;
		}
		this.answering.add(collectorId);
		this.answeredKinds.set(collectorId, collector.data.type);
		this.snapshot = [...this.open.values()];
		this.notifyListeners();
		this.send(collectorId, reactionIndex);
	};

	/**
	 * Answers a collector the screen opened on the player's behalf, so it is never shown. The command
	 * result packet carries the refresh, exactly as it would after a visible answer.
	 */
	public readonly answerWithoutShowing = (collectorId: CollectorId, reactionIndex: number): void => {
		this.hidden.add(collectorId);
		this.forget(collectorId);
		this.send(collectorId, reactionIndex);
	};

	/**
	 * A collector answering a request is pushed too, before the requesting screen had a chance to
	 * answer it itself: waiting one tick lets that answer hide it instead of flashing its window.
	 */
	private readonly trackPushed = (collector: ReactionCollectorCreation): void => {
		setTimeout(() => this.track(collector), 0);
	};

	private readonly send = (collectorId: CollectorId, reactionIndex: number): void => {
		WebSocketClient.getInstance().sendPacket(makeFromClientPacket(ReactionCollectorReactReq, {
			collectorId,
			reactionIndex
		}), {
			[ReactionCollectorEnded.wireName]: (): void => {
				const answeredKind = this.answeredKinds.get(collectorId);
				this.finished.add(collectorId);
				this.forget(collectorId);
				this.hidden.delete(collectorId);
				this.answeredKinds.delete(collectorId);
				if (answeredKind) this.notifyResolution(answeredKind);
			}
		});
	};

	private readonly stop = (packet: ReactionCollectorStop): void => {
		this.finished.add(packet.collectorId);
		this.forget(packet.collectorId);
		this.hidden.delete(packet.collectorId);
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

	// The server stop packet owns refresh; focus refetch covers background expiration.
	private readonly expireLocally = (collectorId: CollectorId): void => {
		this.answeredKinds.delete(collectorId);
		this.forget(collectorId);
	};

	private readonly forget = (collectorId: CollectorId): void => {
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
