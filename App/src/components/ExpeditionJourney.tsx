import {ReactNode} from "react";
import {PetExpeditionRes, PetExpeditionStartedRes} from "ws-packets/src/fromServer/pet/PetExpeditionRes";
import {EXPEDITION_ERRORS} from "ws-packets/src/objects/PetExpedition";
import {Note, Panel} from "@/src/design/Primitives";
import {ExpeditionFoodDetails, ExpeditionProgressDetails} from "@/src/components/ExpeditionDetails";
import {expeditionPetName} from "@/src/display/PetExpedition";
import {formatDurationMinutes} from "@/src/display/ItemEffects";
import {i18n} from "@/src/translations/i18n";

export function ExpeditionStatus({packet}: {packet: PetExpeditionRes}): ReactNode {
	if (packet.hasExpeditionInProgress && packet.expeditionInProgress) return <ExpeditionProgressDetails data={packet.expeditionInProgress} />;
	const reason = packet.hasTalisman ? packet.cannotStartReason ?? EXPEDITION_ERRORS.INVALID_STATE : EXPEDITION_ERRORS.NO_TALISMAN;
	return <>
		{packet.pet ? <Note>{expeditionPetName(packet.pet)}</Note> : null}
		<Note>{i18n.t(packet.canStartExpedition ? "app:expedition.ready" : `app:expedition.errors.${reason}`)}</Note>
	</>;
}

export function ExpeditionStarted({packet}: {packet: PetExpeditionStartedRes}): ReactNode {
	if (!packet.success) return <Note>{i18n.t(`app:expedition.errors.${packet.failureReason ?? EXPEDITION_ERRORS.INVALID_STATE}`)}</Note>;
	return <>
		{packet.expedition ? <ExpeditionProgressDetails data={{...packet.expedition, ...(packet.foodConsumed === undefined ? {} : {foodConsumed: packet.foodConsumed}), ...(packet.foodConsumedDetails ? {foodConsumedDetails: packet.foodConsumedDetails} : {})}} /> : <Panel><ExpeditionFoodDetails amount={packet.foodConsumed} details={packet.foodConsumedDetails} /></Panel>}
		{packet.originalDisplayDurationMinutes !== undefined ? <Note>{i18n.t("app:expedition.plannedDuration", {duration: formatDurationMinutes(packet.originalDisplayDurationMinutes)})}</Note> : null}
		{packet.insufficientFood ? <Note>{i18n.t(`app:expedition.insufficientFood.${packet.insufficientFoodCause ?? "noGuild"}`)}</Note> : null}
	</>;
}