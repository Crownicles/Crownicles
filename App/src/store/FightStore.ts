import {useSyncExternalStore} from "react";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {FightResumeReq} from "ws-packets/src/fromClient/FightReq";
import {FightIntroductionRes, FightStatusRes, FightLogRes, FightEndRes, FightRewardRes, FightWaitRes, FightErrorRes, FightResumeRes} from "ws-packets/src/fromServer/fight/FightRes";
import {FightIntroduction, FightStatus, FightLogEntry, FightEnd, FightReward, FightError, FIGHT_ERRORS} from "ws-packets/src/objects/Fight";
import {WebSocketClient} from "@/src/networking/WebSocketClient";

type Listener = () => void;
export type FightLogRecord = {sequence: number; entry: FightLogEntry; before?: FightStatus; after?: FightStatus};
export type FightSnapshot = {
	introduction: FightIntroduction | null; status: FightStatus | null; logs: FightLogRecord[];
	result: FightEnd | null; reward: FightReward | null; error: FightError | null;
	visible: boolean; waiting: boolean; playedSequence: number;
};
const EMPTY_FIGHT: FightSnapshot = {introduction: null, status: null, logs: [], result: null, reward: null, error: null, visible: false, waiting: false, playedSequence: 0};

class FightStore {
	private snapshot: FightSnapshot = EMPTY_FIGHT;
	private sequence = 0;
	private readonly listeners = new Set<Listener>();

	public constructor() {
		const client = WebSocketClient.getInstance();
		client.registerPushedPacketHandler<FightIntroductionRes>(FightIntroductionRes.wireName, packet => this.introduce(packet.introduction));
		client.registerPushedPacketHandler<FightStatusRes>(FightStatusRes.wireName, packet => this.updateStatus(packet.status));
		client.registerPushedPacketHandler<FightLogRes>(FightLogRes.wireName, packet => this.addLog(packet.entry));
		client.registerPushedPacketHandler<FightWaitRes>(FightWaitRes.wireName, () => this.update({waiting: true}));
		client.registerPushedPacketHandler<FightEndRes>(FightEndRes.wireName, packet => this.update({result: packet.result, waiting: false, visible: true}));
		client.registerPushedPacketHandler<FightRewardRes>(FightRewardRes.wireName, packet => this.update({reward: packet.reward, waiting: false, visible: true}));
		client.registerPushedPacketHandler<FightErrorRes>(FightErrorRes.wireName, packet => this.fail(packet.error));
	}

	/**
	 * Only a fight that already started deserves the battle screen: declining is the player's own
	 * doing, and a refused launch belongs to the arena that asked for it.
	 */
	private fail(error: FightError): void {
		if (error === FIGHT_ERRORS.REFUSED) {
			this.reset();
			return;
		}
		this.update({error, waiting: false, visible: error === FIGHT_ERRORS.BUGGED});
	}

	private introduce(introduction: FightIntroduction): void {
		if (this.snapshot.introduction?.fightId !== introduction.fightId) this.snapshot = EMPTY_FIGHT;
		this.update({introduction, visible: true, error: null});
	}

	private addLog(entry: FightLogEntry): void {
		if (entry.fightId !== this.snapshot.introduction?.fightId) return;
		const record: FightLogRecord = {sequence: ++this.sequence, entry, ...(this.snapshot.status ? {before: this.snapshot.status} : {}), ...(entry.stateAfter ? {after: entry.stateAfter} : {})};
		this.update({logs: [...this.snapshot.logs, record], ...(entry.stateAfter ? {status: entry.stateAfter} : {}), ...(!this.snapshot.visible ? {playedSequence: record.sequence} : {})});
	}

	private updateStatus(status: FightStatus): void {
		if (status.fightId !== this.snapshot.introduction?.fightId) return;
		const logs = this.snapshot.logs.map((record, index, records) => index === records.length - 1 && !record.after ? {...record, after: status} : record);
		this.update({status, logs, waiting: !status.activeFighter.isSelf});
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
	public readonly minimize = (): void => this.update({visible: false, playedSequence: this.snapshot.logs.at(-1)?.sequence ?? this.snapshot.playedSequence});
	public readonly markPlayed = (fightId: string, sequence: number): void => {
		if (fightId !== this.snapshot.introduction?.fightId) return;
		if (sequence <= this.snapshot.playedSequence) return;
		this.update({playedSequence: sequence});
	};
	public readonly reset = (): void => {this.snapshot = EMPTY_FIGHT; this.update({});};
	public readonly syncCurrent = (): void => {
		WebSocketClient.getInstance().sendPacket(makeFromClientPacket(FightResumeReq, {}), {
			[FightResumeRes.wireName]: (packet: FightResumeRes): void => {
				if (packet.active) return;
				if (this.snapshot.result || this.snapshot.error) return;
				this.reset();
			}
		});
	};
}

export const fightStore = new FightStore();
export function useFight(): FightSnapshot {
	return useSyncExternalStore(fightStore.subscribe, fightStore.getSnapshot, fightStore.getSnapshot);
}
