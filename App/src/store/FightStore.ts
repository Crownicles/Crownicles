import {useSyncExternalStore} from "react";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {FightResumeReq} from "ws-packets/src/fromClient/FightReq";
import {FightIntroductionRes, FightStatusRes, FightLogRes, FightEndRes, FightRewardRes, FightWaitRes, FightErrorRes, FightResumeRes} from "ws-packets/src/fromServer/fight/FightRes";
import {FightIntroduction, FightStatus, FightLogEntry, FightEnd, FightReward, FightError} from "ws-packets/src/objects/Fight";
import {WebSocketClient} from "@/src/networking/WebSocketClient";

type Listener = () => void;
export type FightLogRecord = {sequence: number; entry: FightLogEntry};
export type FightSnapshot = {
	introduction: FightIntroduction | null; status: FightStatus | null; logs: FightLogRecord[];
	result: FightEnd | null; reward: FightReward | null; error: FightError | null;
	visible: boolean; waiting: boolean;
};
const EMPTY_FIGHT: FightSnapshot = {introduction: null, status: null, logs: [], result: null, reward: null, error: null, visible: false, waiting: false};

class FightStore {
	private snapshot: FightSnapshot = EMPTY_FIGHT;
	private sequence = 0;
	private readonly listeners = new Set<Listener>();

	public constructor() {
		const client = WebSocketClient.getInstance();
		client.registerPushedPacketHandler<FightIntroductionRes>(FightIntroductionRes.wireName, packet => this.introduce(packet.introduction));
		client.registerPushedPacketHandler<FightStatusRes>(FightStatusRes.wireName, packet => this.update({status: packet.status, waiting: !packet.status.activeFighter.isSelf}));
		client.registerPushedPacketHandler<FightLogRes>(FightLogRes.wireName, packet => this.update({logs: [...this.snapshot.logs, {sequence: ++this.sequence, entry: packet.entry}]}));
		client.registerPushedPacketHandler<FightWaitRes>(FightWaitRes.wireName, () => this.update({waiting: true}));
		client.registerPushedPacketHandler<FightEndRes>(FightEndRes.wireName, packet => this.update({result: packet.result, waiting: false, visible: true}));
		client.registerPushedPacketHandler<FightRewardRes>(FightRewardRes.wireName, packet => this.update({reward: packet.reward, waiting: false, visible: true}));
		client.registerPushedPacketHandler<FightErrorRes>(FightErrorRes.wireName, packet => this.update({error: packet.error, waiting: false, visible: true}));
	}

	private introduce(introduction: FightIntroduction): void {
		if (this.snapshot.introduction?.fightId !== introduction.fightId) this.snapshot = EMPTY_FIGHT;
		this.update({introduction, visible: true, error: null});
	}

	private update(update: Partial<FightSnapshot>): void {
		this.snapshot = {...this.snapshot, ...update};
		for (const listener of this.listeners) listener();
	}

	public readonly subscribe = (listener: Listener): (() => void) => {
		this.listeners.add(listener);
		return (): void => {this.listeners.delete(listener);};
	};
	public readonly getSnapshot = (): FightSnapshot => this.snapshot;
	public readonly show = (): void => this.update({visible: true});
	public readonly minimize = (): void => this.update({visible: false});
	public readonly reset = (): void => {this.snapshot = EMPTY_FIGHT; this.update({});};
	public readonly syncCurrent = (): void => {
		WebSocketClient.getInstance().sendPacket(makeFromClientPacket(FightResumeReq, {}), {
			[FightResumeRes.wireName]: (packet: FightResumeRes): void => {
				if (!packet.active && !this.snapshot.result && !this.snapshot.error) this.reset();
			}
		});
	};
}

export const fightStore = new FightStore();
export function useFight(): FightSnapshot {
	return useSyncExternalStore(fightStore.subscribe, fightStore.getSnapshot, fightStore.getSnapshot);
}
