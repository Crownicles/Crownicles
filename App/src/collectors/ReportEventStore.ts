import {useSyncExternalStore} from "react";
import {ReportBigEventResultRes} from "ws-packets/src/fromServer/report/ReportBigEventResultRes";
import {
	SmallEventLotteryLoseRes,
	SmallEventLotteryNoAnswerRes,
	SmallEventLotteryPoorRes,
	SmallEventLotteryWinRes
} from "ws-packets/src/fromServer/smallEvents/SmallEventLotteryRes";
import {SmallEventResultRes} from "ws-packets/src/fromServer/smallEvents/SmallEventResultRes";
import {
	ReportTokenMerchantBoughtRes,
	ReportTokenMerchantCannotAffordRes,
	ReportTokenMerchantCharityAlreadyUsedRes,
	ReportTokenMerchantCharityRes,
	ReportTokenMerchantFullRes,
	ReportTokenMerchantRefusedRes,
	ReportTokenMerchantTooMuchRes,
	ReportUseTokensAcceptedRes,
	ReportUseTokensRefusedRes
} from "ws-packets/src/fromServer/report/ReportTokenRes";
import {
	ReportBuyHealAcceptedRes,
	ReportBuyHealCannotHealOccupiedRes,
	ReportBuyHealNoAlterationRes,
	ReportBuyHealRefusedRes
} from "ws-packets/src/fromServer/report/ReportHealRes";
import {WebSocketClient} from "@/src/networking/WebSocketClient";

type Listener = () => void;

export type LotteryOutcome =
	| {kind: "noAnswer"; packet: SmallEventLotteryNoAnswerRes}
	| {kind: "poor"; packet: SmallEventLotteryPoorRes}
	| {kind: "win"; packet: SmallEventLotteryWinRes}
	| {kind: "lose"; packet: SmallEventLotteryLoseRes};

export type SmallEventOutcome = SmallEventResultRes;

export type TokenOutcome =
	| {kind: "used"; packet: ReportUseTokensAcceptedRes}
	| {kind: "useRefused"; packet: ReportUseTokensRefusedRes}
	| {kind: "bought"; packet: ReportTokenMerchantBoughtRes}
	| {kind: "tooMuch"; packet: ReportTokenMerchantTooMuchRes}
	| {kind: "full"; packet: ReportTokenMerchantFullRes}
	| {kind: "merchantRefused"; packet: ReportTokenMerchantRefusedRes}
	| {kind: "cannotAfford"; packet: ReportTokenMerchantCannotAffordRes}
	| {kind: "charity"; packet: ReportTokenMerchantCharityRes}
	| {kind: "charityAlreadyUsed"; packet: ReportTokenMerchantCharityAlreadyUsedRes};

export type HealOutcome =
	| {kind: "accepted"; packet: ReportBuyHealAcceptedRes}
	| {kind: "refused"; packet: ReportBuyHealRefusedRes}
	| {kind: "noAlteration"; packet: ReportBuyHealNoAlterationRes}
	| {kind: "cannotHealOccupied"; packet: ReportBuyHealCannotHealOccupiedRes};

/**
 * Keeps the last big-event outcome until the player has read it. The result follows the collector
 * stop packet, so it cannot live in the collector itself.
 */
class ReportEventStore {
	private outcome: ReportBigEventResultRes | null = null;

	private lotteryOutcome: LotteryOutcome | null = null;

	private smallEventOutcome: SmallEventOutcome | null = null;

	private tokenOutcome: TokenOutcome | null = null;

	private healOutcome: HealOutcome | null = null;

	private readonly listeners = new Set<Listener>();

	public constructor() {
		const client = WebSocketClient.getInstance();
		client.registerPushedPacketHandler(ReportBigEventResultRes.name, this.setOutcome);
		client.registerPushedPacketHandler<SmallEventLotteryNoAnswerRes>(SmallEventLotteryNoAnswerRes.name, packet => this.setLotteryOutcome({kind: "noAnswer", packet}));
		client.registerPushedPacketHandler<SmallEventLotteryPoorRes>(SmallEventLotteryPoorRes.name, packet => this.setLotteryOutcome({kind: "poor", packet}));
		client.registerPushedPacketHandler<SmallEventLotteryWinRes>(SmallEventLotteryWinRes.name, packet => this.setLotteryOutcome({kind: "win", packet}));
		client.registerPushedPacketHandler<SmallEventLotteryLoseRes>(SmallEventLotteryLoseRes.name, packet => this.setLotteryOutcome({kind: "lose", packet}));
		client.registerPushedPacketHandler<SmallEventResultRes>(SmallEventResultRes.name, this.setSmallEventOutcome);
		client.registerPushedPacketHandler<ReportUseTokensAcceptedRes>(ReportUseTokensAcceptedRes.name, packet => this.setTokenOutcome({kind: "used", packet}));
		client.registerPushedPacketHandler<ReportUseTokensRefusedRes>(ReportUseTokensRefusedRes.name, packet => this.setTokenOutcome({kind: "useRefused", packet}));
		client.registerPushedPacketHandler<ReportTokenMerchantBoughtRes>(ReportTokenMerchantBoughtRes.name, packet => this.setTokenOutcome({kind: "bought", packet}));
		client.registerPushedPacketHandler<ReportTokenMerchantTooMuchRes>(ReportTokenMerchantTooMuchRes.name, packet => this.setTokenOutcome({kind: "tooMuch", packet}));
		client.registerPushedPacketHandler<ReportTokenMerchantFullRes>(ReportTokenMerchantFullRes.name, packet => this.setTokenOutcome({kind: "full", packet}));
		client.registerPushedPacketHandler<ReportTokenMerchantRefusedRes>(ReportTokenMerchantRefusedRes.name, packet => this.setTokenOutcome({kind: "merchantRefused", packet}));
		client.registerPushedPacketHandler<ReportTokenMerchantCannotAffordRes>(ReportTokenMerchantCannotAffordRes.name, packet => this.setTokenOutcome({kind: "cannotAfford", packet}));
		client.registerPushedPacketHandler<ReportTokenMerchantCharityRes>(ReportTokenMerchantCharityRes.name, packet => this.setTokenOutcome({kind: "charity", packet}));
		client.registerPushedPacketHandler<ReportTokenMerchantCharityAlreadyUsedRes>(ReportTokenMerchantCharityAlreadyUsedRes.name, packet => this.setTokenOutcome({kind: "charityAlreadyUsed", packet}));
		client.registerPushedPacketHandler<ReportBuyHealAcceptedRes>(ReportBuyHealAcceptedRes.name, packet => this.setHealOutcome({kind: "accepted", packet}));
		client.registerPushedPacketHandler<ReportBuyHealRefusedRes>(ReportBuyHealRefusedRes.name, packet => this.setHealOutcome({kind: "refused", packet}));
		client.registerPushedPacketHandler<ReportBuyHealNoAlterationRes>(ReportBuyHealNoAlterationRes.name, packet => this.setHealOutcome({kind: "noAlteration", packet}));
		client.registerPushedPacketHandler<ReportBuyHealCannotHealOccupiedRes>(ReportBuyHealCannotHealOccupiedRes.name, packet => this.setHealOutcome({kind: "cannotHealOccupied", packet}));
	}

	public readonly subscribe = (listener: Listener): (() => void) => {
		this.listeners.add(listener);
		return (): void => {
			this.listeners.delete(listener);
		};
	};

	public readonly getSnapshot = (): ReportBigEventResultRes | null => this.outcome;

	public readonly getLotterySnapshot = (): LotteryOutcome | null => this.lotteryOutcome;

	public readonly getSmallEventSnapshot = (): SmallEventOutcome | null => this.smallEventOutcome;

	public readonly getTokenSnapshot = (): TokenOutcome | null => this.tokenOutcome;

	public readonly getHealSnapshot = (): HealOutcome | null => this.healOutcome;

	public readonly clear = (): void => {
		if (this.outcome === null) {
			return;
		}
		this.outcome = null;
		this.notify();
	};

	public readonly clearLottery = (): void => {
		if (this.lotteryOutcome === null) {
			return;
		}
		this.lotteryOutcome = null;
		this.notify();
	};

	public readonly clearSmallEvent = (): void => {
		if (this.smallEventOutcome === null) {
			return;
		}
		this.smallEventOutcome = null;
		this.notify();
	};

	public readonly clearTokens = (): void => {
		if (this.tokenOutcome === null) {
			return;
		}
		this.tokenOutcome = null;
		this.notify();
	};

	public readonly clearHeal = (): void => {
		if (this.healOutcome === null) {
			return;
		}
		this.healOutcome = null;
		this.notify();
	};

	private readonly setOutcome = (outcome: ReportBigEventResultRes): void => {
		this.outcome = outcome;
		this.notify();
	};

	private readonly setLotteryOutcome = (outcome: LotteryOutcome): void => {
		this.lotteryOutcome = outcome;
		this.notify();
	};

	private readonly setSmallEventOutcome = (outcome: SmallEventOutcome): void => {
		this.smallEventOutcome = outcome;
		this.notify();
	};

	private readonly setTokenOutcome = (outcome: TokenOutcome): void => {
		this.tokenOutcome = outcome;
		this.notify();
	};

	private readonly setHealOutcome = (outcome: HealOutcome): void => {
		this.healOutcome = outcome;
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

export function useLotteryOutcome(): LotteryOutcome | null {
	return useSyncExternalStore(reportEventStore.subscribe, reportEventStore.getLotterySnapshot, reportEventStore.getLotterySnapshot);
}

export function useSmallEventOutcome(): SmallEventOutcome | null {
	return useSyncExternalStore(reportEventStore.subscribe, reportEventStore.getSmallEventSnapshot, reportEventStore.getSmallEventSnapshot);
}

export function useTokenOutcome(): TokenOutcome | null {
	return useSyncExternalStore(reportEventStore.subscribe, reportEventStore.getTokenSnapshot, reportEventStore.getTokenSnapshot);
}

export function useHealOutcome(): HealOutcome | null {
	return useSyncExternalStore(reportEventStore.subscribe, reportEventStore.getHealSnapshot, reportEventStore.getHealSnapshot);
}
