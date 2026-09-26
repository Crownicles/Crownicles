import {useSyncExternalStore} from "react";
import {ReportBigEventResultRes} from "ws-packets/src/fromServer/report/ReportBigEventResultRes";
import {
	SmallEventLotteryLoseRes,
	SmallEventLotteryNoAnswerRes,
	SmallEventLotteryPoorRes,
	SmallEventLotteryWinRes
} from "ws-packets/src/fromServer/smallEvents/SmallEventLotteryRes";
import {SmallEventResultRes} from "ws-packets/src/fromServer/smallEvents/SmallEventResultRes";
import {SmallEventWitchResultRes} from "ws-packets/src/fromServer/smallEvents/SmallEventWitchResultRes";
import {SmallEventChoiceResultRes} from "ws-packets/src/fromServer/smallEvents/SmallEventChoiceResultRes";
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
import {ShopNoPetRes, ShopOutcome, ShopOutcomeRes, ShopPetCheckupRes} from "ws-packets/src/fromServer/shop/ShopRes";
import {ReportPveFightRefusedRes, ReportPveNoMonsterRes} from "ws-packets/src/fromServer/report/ReportPveFightRes";
import {WebSocketClient} from "@/src/networking/WebSocketClient";

type Listener = () => void;

const SILENT_SMALL_EVENT_SUFFIXES = ["RefusePacket", "RefusedPacket", "NoAnswerPacket"];

function shouldPresentAutomaticSmallEvent(outcome: SmallEventResultRes): boolean {
	return !SILENT_SMALL_EVENT_SUFFIXES.some(suffix => outcome.eventName.endsWith(suffix));
}

export type LotteryOutcome =
	| {kind: "noAnswer"; packet: SmallEventLotteryNoAnswerRes}
	| {kind: "poor"; packet: SmallEventLotteryPoorRes}
	| {kind: "win"; packet: SmallEventLotteryWinRes}
	| {kind: "lose"; packet: SmallEventLotteryLoseRes};

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

export type TokenOutcomeRequiringAcknowledgement = Exclude<TokenOutcome,
{kind: "used" | "useRefused" | "merchantRefused"}>;

export type HealOutcome =
	| {kind: "accepted"; packet: ReportBuyHealAcceptedRes}
	| {kind: "refused"; packet: ReportBuyHealRefusedRes}
	| {kind: "noAlteration"; packet: ReportBuyHealNoAlterationRes}
	| {kind: "cannotHealOccupied"; packet: ReportBuyHealCannotHealOccupiedRes};

export type ShopResult =
	| {kind: "checkup"; packet: ShopPetCheckupRes}
	| {kind: "noPet"}
	| {kind: "outcome"; outcome: ShopOutcome};

/** How an island boss encounter ended when no fight took place. */
export const PVE_FIGHT_OUTCOMES = {REFUSED: "refused", NO_MONSTER: "noMonster"} as const;
export type PveFightOutcome = typeof PVE_FIGHT_OUTCOMES[keyof typeof PVE_FIGHT_OUTCOMES];

/**
 * Keeps the last big-event outcome until the player has read it. The result follows the collector
 * stop packet, so it cannot live in the collector itself.
 */
class ReportEventStore {
	private outcome: ReportBigEventResultRes | null = null;

	private lotteryOutcome: LotteryOutcome | null = null;

	private witchOutcome: SmallEventWitchResultRes | null = null;

	private choiceOutcome: SmallEventChoiceResultRes | null = null;

	private automaticOutcome: SmallEventResultRes | null = null;

	private tokenOutcome: TokenOutcome | null = null;

	private healOutcome: HealOutcome | null = null;

	private shopResult: ShopResult | null = null;

	private pveFightOutcome: PveFightOutcome | null = null;

	private readonly listeners = new Set<Listener>();

	public constructor() {
		const client = WebSocketClient.getInstance();
		client.registerPushedPacketHandler(ReportBigEventResultRes.wireName, this.setOutcome);
		client.registerPushedPacketHandler<SmallEventLotteryNoAnswerRes>(SmallEventLotteryNoAnswerRes.wireName, packet => this.setLotteryOutcome({kind: "noAnswer", packet}));
		client.registerPushedPacketHandler<SmallEventLotteryPoorRes>(SmallEventLotteryPoorRes.wireName, packet => this.setLotteryOutcome({kind: "poor", packet}));
		client.registerPushedPacketHandler<SmallEventLotteryWinRes>(SmallEventLotteryWinRes.wireName, packet => this.setLotteryOutcome({kind: "win", packet}));
		client.registerPushedPacketHandler<SmallEventLotteryLoseRes>(SmallEventLotteryLoseRes.wireName, packet => this.setLotteryOutcome({kind: "lose", packet}));
		client.registerPushedPacketHandler<SmallEventResultRes>(SmallEventResultRes.wireName, this.setAutomaticOutcome);
		client.registerPushedPacketHandler<SmallEventWitchResultRes>(SmallEventWitchResultRes.wireName, this.setWitchOutcome);
		client.registerPushedPacketHandler<SmallEventChoiceResultRes>(SmallEventChoiceResultRes.wireName, this.setChoiceOutcome);
		client.registerPushedPacketHandler<ReportUseTokensAcceptedRes>(ReportUseTokensAcceptedRes.wireName, packet => this.setTokenOutcome({kind: "used", packet}));
		client.registerPushedPacketHandler<ReportUseTokensRefusedRes>(ReportUseTokensRefusedRes.wireName, packet => this.setTokenOutcome({kind: "useRefused", packet}));
		client.registerPushedPacketHandler<ReportTokenMerchantBoughtRes>(ReportTokenMerchantBoughtRes.wireName, packet => this.setTokenOutcome({kind: "bought", packet}));
		client.registerPushedPacketHandler<ReportTokenMerchantTooMuchRes>(ReportTokenMerchantTooMuchRes.wireName, packet => this.setTokenOutcome({kind: "tooMuch", packet}));
		client.registerPushedPacketHandler<ReportTokenMerchantFullRes>(ReportTokenMerchantFullRes.wireName, packet => this.setTokenOutcome({kind: "full", packet}));
		client.registerPushedPacketHandler<ReportTokenMerchantRefusedRes>(ReportTokenMerchantRefusedRes.wireName, packet => this.setTokenOutcome({kind: "merchantRefused", packet}));
		client.registerPushedPacketHandler<ReportTokenMerchantCannotAffordRes>(ReportTokenMerchantCannotAffordRes.wireName, packet => this.setTokenOutcome({kind: "cannotAfford", packet}));
		client.registerPushedPacketHandler<ReportTokenMerchantCharityRes>(ReportTokenMerchantCharityRes.wireName, packet => this.setTokenOutcome({kind: "charity", packet}));
		client.registerPushedPacketHandler<ReportTokenMerchantCharityAlreadyUsedRes>(ReportTokenMerchantCharityAlreadyUsedRes.wireName, packet => this.setTokenOutcome({kind: "charityAlreadyUsed", packet}));
		client.registerPushedPacketHandler<ReportBuyHealAcceptedRes>(ReportBuyHealAcceptedRes.wireName, packet => this.setHealOutcome({kind: "accepted", packet}));
		client.registerPushedPacketHandler<ReportBuyHealRefusedRes>(ReportBuyHealRefusedRes.wireName, packet => this.setHealOutcome({kind: "refused", packet}));
		client.registerPushedPacketHandler<ReportBuyHealNoAlterationRes>(ReportBuyHealNoAlterationRes.wireName, packet => this.setHealOutcome({kind: "noAlteration", packet}));
		client.registerPushedPacketHandler<ReportBuyHealCannotHealOccupiedRes>(ReportBuyHealCannotHealOccupiedRes.wireName, packet => this.setHealOutcome({kind: "cannotHealOccupied", packet}));
		client.registerPushedPacketHandler<ShopPetCheckupRes>(ShopPetCheckupRes.wireName, packet => this.setShopResult({kind: "checkup", packet}));
		client.registerPushedPacketHandler<ShopNoPetRes>(ShopNoPetRes.wireName, () => this.setShopResult({kind: "noPet"}));
		client.registerPushedPacketHandler<ShopOutcomeRes>(ShopOutcomeRes.wireName, packet => this.setShopResult({kind: "outcome", outcome: packet.outcome}));
		client.registerPushedPacketHandler<ReportPveFightRefusedRes>(ReportPveFightRefusedRes.wireName, () => this.setPveFightOutcome(PVE_FIGHT_OUTCOMES.REFUSED));
		client.registerPushedPacketHandler<ReportPveNoMonsterRes>(ReportPveNoMonsterRes.wireName, () => this.setPveFightOutcome(PVE_FIGHT_OUTCOMES.NO_MONSTER));
	}

	public readonly subscribe = (listener: Listener): (() => void) => {
		this.listeners.add(listener);
		return (): void => {
			this.listeners.delete(listener);
		};
	};

	public readonly getSnapshot = (): ReportBigEventResultRes | null => this.outcome;

	public readonly getLotterySnapshot = (): LotteryOutcome | null => this.lotteryOutcome;

	public readonly getWitchSnapshot = (): SmallEventWitchResultRes | null => this.witchOutcome;

	public readonly getChoiceSnapshot = (): SmallEventChoiceResultRes | null => this.choiceOutcome;

	public readonly getAutomaticSnapshot = (): SmallEventResultRes | null => this.automaticOutcome;

	public readonly getTokenSnapshot = (): TokenOutcome | null => this.tokenOutcome;

	public readonly getHealSnapshot = (): HealOutcome | null => this.healOutcome;

	public readonly getShopResultSnapshot = (): ShopResult | null => this.shopResult;

	public readonly getPveFightSnapshot = (): PveFightOutcome | null => this.pveFightOutcome;

	public readonly reset = (): void => {
		this.outcome = null;
		this.lotteryOutcome = null;
		this.witchOutcome = null;
		this.choiceOutcome = null;
		this.automaticOutcome = null;
		this.tokenOutcome = null;
		this.healOutcome = null;
		this.shopResult = null;
		this.pveFightOutcome = null;
		this.notify();
	};

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

	public readonly clearWitch = (): void => {
		if (this.witchOutcome === null) {
			return;
		}
		this.witchOutcome = null;
		this.notify();
	};

	public readonly clearChoice = (): void => {
		if (this.choiceOutcome === null) {
			return;
		}
		this.choiceOutcome = null;
		this.notify();
	};

	public readonly clearAutomatic = (): void => {
		if (this.automaticOutcome === null) {
			return;
		}
		this.automaticOutcome = null;
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

	public readonly clearShopResult = (): void => {
		if (this.shopResult === null) {
			return;
		}
		this.shopResult = null;
		this.notify();
	};

	public readonly clearPveFight = (): void => {
		if (this.pveFightOutcome === null) {
			return;
		}
		this.pveFightOutcome = null;
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

	private readonly setWitchOutcome = (outcome: SmallEventWitchResultRes): void => {
		this.witchOutcome = outcome;
		this.notify();
	};

	private readonly setChoiceOutcome = (outcome: SmallEventChoiceResultRes): void => {
		this.choiceOutcome = outcome;
		this.notify();
	};

	private readonly setAutomaticOutcome = (outcome: SmallEventResultRes): void => {
		if (!shouldPresentAutomaticSmallEvent(outcome)) {
			return;
		}
		this.automaticOutcome = outcome;
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

	private readonly setShopResult = (result: ShopResult): void => {
		this.shopResult = result;
		this.notify();
	};

	private readonly setPveFightOutcome = (outcome: PveFightOutcome): void => {
		this.pveFightOutcome = outcome;
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

export function useWitchOutcome(): SmallEventWitchResultRes | null {
	return useSyncExternalStore(reportEventStore.subscribe, reportEventStore.getWitchSnapshot, reportEventStore.getWitchSnapshot);
}

export function useSmallEventChoiceOutcome(): SmallEventChoiceResultRes | null {
	return useSyncExternalStore(reportEventStore.subscribe, reportEventStore.getChoiceSnapshot, reportEventStore.getChoiceSnapshot);
}

export function useAutomaticSmallEventOutcome(): SmallEventResultRes | null {
	return useSyncExternalStore(reportEventStore.subscribe, reportEventStore.getAutomaticSnapshot, reportEventStore.getAutomaticSnapshot);
}

export function useTokenOutcome(): TokenOutcome | null {
	return useSyncExternalStore(reportEventStore.subscribe, reportEventStore.getTokenSnapshot, reportEventStore.getTokenSnapshot);
}

export function useHealOutcome(): HealOutcome | null {
	return useSyncExternalStore(reportEventStore.subscribe, reportEventStore.getHealSnapshot, reportEventStore.getHealSnapshot);
}

export function useShopResult(): ShopResult | null {
	return useSyncExternalStore(reportEventStore.subscribe, reportEventStore.getShopResultSnapshot, reportEventStore.getShopResultSnapshot);
}

export function usePveFightOutcome(): PveFightOutcome | null {
	return useSyncExternalStore(reportEventStore.subscribe, reportEventStore.getPveFightSnapshot, reportEventStore.getPveFightSnapshot);
}
