import {ReactNode} from "react";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {GENERIC_REACTION_KINDS, PLAYER_UTILITY_DATA_KINDS, ReactionCollectorData} from "ws-packets/src/fromServer/collectors";
import {PlayerUtilityOutcome as Outcome} from "ws-packets/src/objects/PlayerUtility";
import {Button, ButtonRow, Confirmation, KeyValue, Note, Panel} from "@/src/design/Primitives";
import {CollectorChoices} from "@/src/collectors/CollectorPrompt";
import {useCollectorAnswer} from "@/src/collectors/useCollectorAnswer";
import {formatMoney, formatNumber} from "@/src/display/Amounts";
import {AppIcons} from "@/src/AppIcons";
import {i18n} from "@/src/translations/i18n";

function UtilityDetails({data}: {data: ReactionCollectorData}): ReactNode {
	if (data.type === PLAYER_UTILITY_DATA_KINDS.UNLOCK) return <Panel>
		<KeyValue label={i18n.t("app:utilities.prisoner")} value={data.data.playerName ?? i18n.t("app:arena.unknownPlayer")} />
		<KeyValue label={i18n.t("app:pet.care.price")} value={formatMoney(data.data.price)} />
	</Panel>;
	if (data.type === PLAYER_UTILITY_DATA_KINDS.BOAT) return <Panel>
		<KeyValue label={i18n.t("app:pet.care.price")} value={`${formatNumber(data.data.price)} ${AppIcons.getIcon("unitValues.gem")}`} />
		<KeyValue label={i18n.t("app:arena.energy")} value={i18n.t("app:profile.formats.progress", {value: data.data.energy.current, max: data.data.energy.max})} />
	</Panel>;
	return null;
}

export function PlayerUtilityCollector({collector, onChoose, submitting}: {collector: ReactionCollectorCreation; onChoose: (index: number) => void; submitting: boolean}): ReactNode {
	const {answer, locked} = useCollectorAnswer(collector, onChoose, submitting);
	return <Confirmation title={i18n.t(collector.data.type === PLAYER_UTILITY_DATA_KINDS.UNLOCK ? "app:utilities.unlock" : "app:utilities.boat")} onRequestClose={(): void => answer(collector.reactions.findIndex(reaction => reaction.type === GENERIC_REACTION_KINDS.REFUSE))}>
		<UtilityDetails data={collector.data} />
		<CollectorChoices collector={collector} onChoose={answer} submitting={locked} />
	</Confirmation>;
}

function UtilityResult({outcome}: {outcome: Outcome}): ReactNode {
	switch (outcome.type) {
		case "error": return <Note>{i18n.t(`app:utilities.errors.${outcome.error}`)}</Note>;
		case "money": return <Note>{i18n.t("app:utilities.moneyError", {money: formatMoney(outcome.money)})}</Note>;
		case "respawn": return <Note>{i18n.t("app:utilities.respawned", {lostScore: formatNumber(outcome.lostScore)})}</Note>;
		case "boat": return <Note>{i18n.t("app:utilities.boatJoined", {score: formatNumber(outcome.score)})}</Note>;
		default: return <Note>{i18n.t("app:utilities.unlocked", {name: outcome.playerName ?? i18n.t("app:arena.unknownPlayer")})}</Note>;
	}
}

export function PlayerUtilityOutcome({outcome, onContinue}: {outcome: Outcome; onContinue: () => void}): ReactNode {
	return <Confirmation title={i18n.t("app:utilities.result")} onRequestClose={onContinue}>
		<UtilityResult outcome={outcome} />
		<ButtonRow><Button onPress={onContinue}>{i18n.t("app:common.back")}</Button></ButtonRow>
	</Confirmation>;
}
