import {ReactNode} from "react";
import {FromServerPacket} from "ws-packets/src/fromServer/FromServerPacket";
import {PlayerUtilityRes} from "ws-packets/src/fromServer/common/PlayerUtilityRes";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {GENERIC_REACTION_KINDS, PLAYER_UTILITY_DATA_KINDS, ReactionCollectorData} from "ws-packets/src/fromServer/collectors";
import {PlayerUtilityOutcome as Outcome} from "ws-packets/src/objects/PlayerUtility";
import {ExpandableList, Fact, QuestionSheet, Toast} from "@/src/design/Sections";
import {CollectorDecision} from "@/src/collectors/CollectorPrompt";
import {useCollectorAnswer} from "@/src/collectors/useCollectorAnswer";
import {formatMoney, formatNumber} from "@/src/display/Amounts";
import {AppIcons} from "@/src/AppIcons";
import {i18n} from "@/src/translations/i18n";

function UtilityDetails({data}: {data: ReactionCollectorData}): ReactNode {
	if (data.type === PLAYER_UTILITY_DATA_KINDS.UNLOCK) return <>
		<Fact label={i18n.t("app:utilities.prisoner")} value={data.data.playerName ?? i18n.t("error:unknownPlayer")} />
		<Fact label={i18n.t("app:pet.care.price")} value={formatMoney(data.data.price)} />
	</>;
	if (data.type === PLAYER_UTILITY_DATA_KINDS.BOAT) return <>
		<Fact label={i18n.t("app:pet.care.price")} value={`${formatNumber(data.data.price)} ${AppIcons.getIcon("unitValues.gem")}`} />
		<Fact label={i18n.t("app:arena.energy")} value={i18n.t("app:profile.formats.progress", {value: data.data.energy.current, max: data.data.energy.max})} />
	</>;
	return null;
}

export function PlayerUtilityCollector({collector, onChoose, submitting}: {collector: ReactionCollectorCreation; onChoose: (index: number) => void; submitting: boolean}): ReactNode {
	const {answer, locked} = useCollectorAnswer(collector, onChoose, submitting);
	const refuse = (): void => answer(collector.reactions.findIndex(reaction => reaction.type === GENERIC_REACTION_KINDS.REFUSE));
	return <QuestionSheet
		caption={i18n.t("app:utilities.title")}
		title={i18n.t(collector.data.type === PLAYER_UTILITY_DATA_KINDS.UNLOCK ? "app:utilities.unlock" : "app:utilities.boat")}
		onClose={refuse}
	>
		<ExpandableList><UtilityDetails data={collector.data} /></ExpandableList>
		<CollectorDecision collector={collector} onChoose={answer} submitting={locked} />
	</QuestionSheet>;
}

/** Why Core turned a request down, or null when the outcome is a result worth its own sheet. */
export function utilityRefusal(outcome: Outcome): string | null {
	if (outcome.type === "error") return i18n.t(`app:utilities.errors.${outcome.error}`);
	return outcome.type === "money" ? i18n.t("app:utilities.moneyError", {money: formatMoney(outcome.money)}) : null;
}

/** The refusal a utility menu reads from its outcome packet. */
export function utilityPacketRefusal(packet: FromServerPacket): string | null {
	return utilityRefusal((packet as PlayerUtilityRes).outcome);
}

function utilityResult(outcome: Outcome): string | null {
	const refusal = utilityRefusal(outcome);
	if (refusal !== null) return refusal;
	switch (outcome.type) {
		case "respawn": return i18n.t("app:utilities.respawned", {lostScore: formatNumber(outcome.lostScore)});
		case "boat": return i18n.t("app:utilities.boatJoined", {score: formatNumber(outcome.score)});
		case "unlocked": return i18n.t("app:utilities.unlocked", {name: outcome.playerName ?? i18n.t("error:unknownPlayer")});
		default: return null;
	}
}

/** Each result is one sentence the screen behind already reflects: said in passing. */
export function PlayerUtilityOutcome({outcome, onContinue}: {outcome: Outcome; onContinue: () => void}): ReactNode {
	const result = utilityResult(outcome);
	return <Toast title={i18n.t("app:utilities.result")} {...result ? {subtitle: result} : {}} onDismiss={onContinue} />;
}
