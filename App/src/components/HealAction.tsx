import {ReactNode, useState} from "react";
import {notificationAsync, NotificationFeedbackType} from "expo-haptics";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {ReportBuyHealReq} from "ws-packets/src/fromClient/ReportBuyHealReq";
import {ReportTravelSummaryRes} from "ws-packets/src/fromServer/report/ReportTravelSummaryRes";
import {
	ReportBuyHealAcceptedRes,
	ReportBuyHealCannotHealOccupiedRes,
	ReportBuyHealNoAlterationRes,
	ReportBuyHealRefusedRes
} from "ws-packets/src/fromServer/report/ReportHealRes";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {GENERIC_REACTION_KINDS, REPORT_COLLECTOR_DATA_KINDS} from "ws-packets/src/fromServer/collectors";
import {AppIcons} from "@/src/AppIcons";
import {GameAnswer, GameClient} from "@/src/networking/GameClient";
import {reportEventStore} from "@/src/collectors/ReportEventStore";
import {Cure} from "@/src/components/CureEmblem";
import {ActionBanner} from "@/src/design/Sections";
import {CircleAlert} from "@/src/design/FightIcons";
import {formatMoney} from "@/src/display/Amounts";
import {isAlterationReport} from "@/src/display/ReportTiming";
import {SilentAnswer, useReportShortcut} from "@/src/store/useReportShortcut";
import {i18n} from "@/src/translations/i18n";

/** A report-side action the player triggers, and whether Core is still answering it. */
export type PendingAction = {pending: boolean; onPress: () => void};

export type HealOffer = NonNullable<ReportTravelSummaryRes["heal"]>;

/** Out on the road anything can be cured; in a city only an alteration is. */
export function canCure(packet: ReportTravelSummaryRes): boolean {
	return !packet.isInCity || isAlterationReport(packet);
}

/** The cure the report offers, when the player can take it where they stand. */
export function healOffer(packet: ReportTravelSummaryRes | undefined): HealOffer | null {
	return packet?.heal && canCure(packet) ? packet.heal : null;
}

/** Long enough for the whole cure choreography, so only a cure whose emblem vanished ends here. */
const CURE_SAFETY_MS = 5_000;

export function acceptAnswer(collector: ReactionCollectorCreation): SilentAnswer | null {
	const reactionIndex = collector.reactions.findIndex(reaction => reaction.type === GENERIC_REACTION_KINDS.ACCEPT);
	return reactionIndex >= 0 ? {collectorId: collector.id, reactionIndex} : null;
}

export function celebrate(): void {
	notificationAsync(NotificationFeedbackType.Success).catch(() => undefined);
}

/** The heal button already names its price, so pressing it answers Core's confirmation the same way. */
function healConfirmation(answer: GameAnswer<ReactionCollectorCreation>): SilentAnswer | null {
	if (answer.kind !== "answer" || answer.packet.data.type !== REPORT_COLLECTOR_DATA_KINDS.BUY_HEAL) return null;
	return acceptAnswer(answer.packet);
}

function requestBuyHeal(): Promise<GameAnswer<ReactionCollectorCreation>> {
	return GameClient.request(makeFromClientPacket(ReportBuyHealReq, {}), ReactionCollectorCreation, [
		ReportBuyHealAcceptedRes,
		ReportBuyHealRefusedRes,
		ReportBuyHealNoAlterationRes,
		ReportBuyHealCannotHealOccupiedRes
	]);
}

/** Ends the cure once: when the emblem finishes it, or later if the screen refreshes into a layout without the emblem. */
function once(finish: () => void): () => void {
	let finished = false;
	const end = (): void => {
		if (finished) return;
		finished = true;
		finish();
	};
	setTimeout(end, CURE_SAFETY_MS);
	return end;
}

export function HealAction({heal, action}: {heal: HealOffer; action: PendingAction}): ReactNode {
	return <ActionBanner
		icon={CircleAlert}
		emoji={AppIcons.getIcon("shopItems.healAlteration")}
		label={i18n.t("app:adventure.quick.healWithCost", {price: formatMoney(heal.price)})}
		pending={action.pending}
		{...heal.canAfford ? {} : {lock: {reason: i18n.t("app:adventure.quick.healNotEnough", {price: formatMoney(heal.price)}), icon: CircleAlert}}}
		onPress={action.onPress}
	/>;
}

/** Buys the cure the button names, then plays it on the ailment's emblem before handing back. */
export function useBuyHeal(effect: string | undefined, onSettled?: () => void): {action: PendingAction; cure: Cure | null} {
	const heal = useReportShortcut({request: requestBuyHeal, confirm: healConfirmation, outcome: reportEventStore.getHealSnapshot});
	const [cure, setCure] = useState<Cure | null>(null);
	const onPress = (): void => {
		const ailment = effect ? AppIcons.getIconOrNull(`effects.${effect}`) : null;
		heal.run((outcome, done) => {
			const finish = (): void => {
				done();
				onSettled?.();
			};
			if (outcome.kind !== "accepted" || !ailment) {
				finish();
				return;
			}
			celebrate();
			setCure({from: ailment, onDone: once(() => {
				setCure(null);
				finish();
			})});
		});
	};
	return {action: {pending: heal.pending, onPress}, cure};
}
