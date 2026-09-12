import {ReactNode} from "react";
import {Modal, StyleSheet} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {PetExpeditionRes, PetExpeditionStartedRes, PetExpeditionResolveRes} from "ws-packets/src/fromServer/pet/PetExpeditionRes";
import {EXPEDITION_ERRORS} from "ws-packets/src/objects/PetExpedition";
import {ExpeditionOutcome} from "@/src/store/useExpeditionOutcome";
import {Button, ButtonRow, Hero, KeyValue, Note, Panel, Screen} from "@/src/design/Primitives";
import {Theme} from "@/src/design/Theme";
import {ExpeditionFoodDetails, ExpeditionProgressDetails, ExpeditionRewardDetails} from "@/src/components/ExpeditionDetails";
import {expeditionLocationName, expeditionPetName} from "@/src/display/PetExpedition";
import {formatDurationMinutes} from "@/src/display/ItemEffects";
import {formatNumber} from "@/src/display/Amounts";
import {i18n} from "@/src/translations/i18n";

const styles = StyleSheet.create({root: {flex: 1, backgroundColor: Theme.colors.paper}});

function ExpeditionStatus({packet}: {packet: PetExpeditionRes}): ReactNode {
	if (packet.hasExpeditionInProgress && packet.expeditionInProgress) return <ExpeditionProgressDetails data={packet.expeditionInProgress} />;
	const reason = packet.hasTalisman ? packet.cannotStartReason ?? EXPEDITION_ERRORS.INVALID_STATE : EXPEDITION_ERRORS.NO_TALISMAN;
	return <>
		{packet.pet ? <Note>{expeditionPetName(packet.pet)}</Note> : null}
		<Note>{i18n.t(packet.canStartExpedition ? "app:expedition.ready" : `app:expedition.errors.${reason}`)}</Note>
	</>;
}

function ExpeditionStarted({packet}: {packet: PetExpeditionStartedRes}): ReactNode {
	if (!packet.success) return <Note>{i18n.t(`app:expedition.errors.${packet.failureReason ?? EXPEDITION_ERRORS.INVALID_STATE}`)}</Note>;
	return <>
		{packet.expedition ? <ExpeditionProgressDetails data={{...packet.expedition, ...(packet.foodConsumed === undefined ? {} : {foodConsumed: packet.foodConsumed}), ...(packet.foodConsumedDetails ? {foodConsumedDetails: packet.foodConsumedDetails} : {})}} /> : <Panel><ExpeditionFoodDetails amount={packet.foodConsumed} details={packet.foodConsumedDetails} /></Panel>}
		{packet.originalDisplayDurationMinutes !== undefined ? <Note>{i18n.t("app:expedition.plannedDuration", {duration: formatDurationMinutes(packet.originalDisplayDurationMinutes)})}</Note> : null}
		{packet.insufficientFood ? <Note>{i18n.t(`app:expedition.insufficientFood.${packet.insufficientFoodCause ?? "noGuild"}`)}</Note> : null}
	</>;
}

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
		<SafeAreaView style={styles.root}><OutcomeMenu outcome={outcome} onContinue={onContinue} /></SafeAreaView>
	</Modal>;
}