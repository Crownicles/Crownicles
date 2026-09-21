import {ReactNode} from "react";
import {Modal} from "react-native";
import {PetExpeditionResolveRes} from "ws-packets/src/fromServer/pet/PetExpeditionRes";
import {ExpeditionOutcome} from "@/src/store/useExpeditionOutcome";
import {Button, ButtonRow, Hero, KeyValue, Note, Panel, Screen} from "@/src/design/Primitives";
import {ModalSurface} from "@/src/design/Sections";
import {ExpeditionRewardDetails} from "@/src/components/ExpeditionDetails";
import {ExpeditionStarted, ExpeditionStatus} from "@/src/components/ExpeditionJourney";
import {expeditionLocationName, expeditionPetName} from "@/src/display/PetExpedition";
import {formatNumber} from "@/src/display/Amounts";
import {i18n} from "@/src/translations/i18n";


function ExpeditionResolved({packet}: {packet: PetExpeditionResolveRes}): ReactNode {
	const result = packet.totalFailure ? "failure" : packet.partialSuccess ? "partial" : packet.success ? "success" : "failure";
	return <>
		<Note>{expeditionPetName(packet.pet)}</Note>
		<Note>{expeditionLocationName(packet.expedition)}</Note>
		<Note>{i18n.t(`app:expedition.resolved.${result}`)}</Note>
		{packet.rewards ? <ExpeditionRewardDetails rewards={packet.rewards} /> : null}
		<Panel><KeyValue label={i18n.t("app:expedition.loveChange")} value={formatNumber(packet.loveChange)} /></Panel>
		{packet.petLikedExpedition ? <Note>{i18n.t("app:expedition.liked")}</Note> : null}
		{packet.badgeEarned ? <Note>{i18n.t("app:expedition.badge", {badge: i18n.t(`app:reference.badges.names.${packet.badgeEarned}`)})}</Note> : null}
	</>;
}

function OutcomeContent({outcome}: {outcome: ExpeditionOutcome}): ReactNode {
	switch (outcome.kind) {
		case "status": return <ExpeditionStatus packet={outcome.packet} />;
		case "started": return <ExpeditionStarted packet={outcome.packet} />;
		case "resolved": return <ExpeditionResolved packet={outcome.packet} />;
		case "error": return <Note>{i18n.t(`app:expedition.errors.${outcome.packet.errorCode}`)}</Note>;
		default: return <>
			<Note>{expeditionPetName(outcome.packet.pet)}</Note>
			<Note>{i18n.t("app:expedition.loveLost", {amount: outcome.packet.loveLost})}</Note>
			{outcome.kind === "cancelled" && outcome.packet.isFreeCancellation ? <Note>{i18n.t("app:expedition.freeCancellation")}</Note> : null}
		</>;
	}
}

function OutcomeMenu({outcome, onContinue}: {outcome: ExpeditionOutcome; onContinue: () => void}): ReactNode {
	return <Screen>
		<Hero eyebrow={i18n.t("app:pet.eyebrow")} title={i18n.t(`app:expedition.outcomes.${outcome.kind}`)} />
		<OutcomeContent outcome={outcome} />
		<ButtonRow><Button variant="primary" onPress={onContinue}>{i18n.t("app:common.back")}</Button></ButtonRow>
	</Screen>;
}

export function PetExpeditionOutcome({outcome, onContinue}: {outcome: ExpeditionOutcome; onContinue: () => void}): ReactNode {
	return <Modal visible animationType="slide" onRequestClose={onContinue}>
		<ModalSurface><OutcomeMenu outcome={outcome} onContinue={onContinue} /></ModalSurface>
	</Modal>;
}