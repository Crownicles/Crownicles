import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {ReactionCollectorStop, COLLECTOR_STOP_REASONS} from "ws-packets/src/fromServer/common/ReactionCollectorStop";
import {ReactionCollectorReactReq} from "ws-packets/src/fromClient/ReactionCollectorReactReq";
import {ReactionCollectorDataKind} from "ws-packets/src/fromServer/collectors";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
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

	public readonly track = (collector: ReactionCollectorCreation): void => {
		if (this.open.has(collector.id)) {
			return;
		}

		this.open.set(collector.id, collector);
		this.snapshot = [...this.open.values()];
		this.notifyListeners();

		const timer = setTimeout((): void => {
			this.answeredKinds.delete(collector.id);
			this.forget(collector.id);
		}, Math.max(0, collector.endTime - Date.now()));
		this.timers.set(collector.id, timer);
	};

	public readonly removeExpired = (now: number = Date.now()): void => {
		for (const [collectorId, collector] of this.open) {
			if (collector.endTime <= now) {
				this.answeredKinds.delete(collectorId);
				this.forget(collectorId);
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
			for (const listener of this.resolutionListeners) {
				listener(answeredKind);
			}
		}
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
}

export const collectorsStore = new CollectorsStore();
