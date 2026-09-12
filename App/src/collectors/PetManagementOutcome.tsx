import {ReactNode} from "react";
import {PetFreeStatus, PetManagementOutcome as Outcome} from "ws-packets/src/objects/PetManagement";
import {Button, ButtonRow, Confirmation, KeyValue, Note, Panel} from "@/src/design/Primitives";
import {formatMoney} from "@/src/display/Amounts";
import {formatDurationMinutes} from "@/src/display/ItemEffects";
import {petName} from "@/src/display/PetDisplay";
import {expeditionPetName} from "@/src/display/PetExpedition";
import {i18n} from "@/src/translations/i18n";

const MILLISECONDS_PER_MINUTE = 60_000;
function statusMessage(status: PetFreeStatus): string {
	if (!status.foundPet) return i18n.t("app:pet.noPet");
	if (status.petOnExpedition) return i18n.t("app:pet.feed.errors.expedition");
	if (status.cooldownRemainingTimeMs) return i18n.t("app:pet.management.cooldown", {duration: formatDurationMinutes(status.cooldownRemainingTimeMs / MILLISECONDS_PER_MINUTE)});
	if (status.missingMoney) return i18n.t("app:pet.management.missingMoney", {money: formatMoney(status.missingMoney)});
	return i18n.t(status.petCanBeFreed ? "app:pet.management.available" : "app:pet.management.errors.changed");
}

function ManagementResult({outcome}: {outcome: Outcome}): ReactNode {
	if (outcome.type === "error") return <Note>{i18n.t(`app:pet.management.errors.${outcome.error}`)}</Note>;
	if (outcome.type === "freeStatus") return <Note>{statusMessage(outcome.status)}</Note>;
	if (outcome.type === "transfer") return <Panel>
		{outcome.oldPet ? <KeyValue label={i18n.t("app:pet.management.deposited")} value={petName(outcome.oldPet)} /> : null}
		{outcome.newPet ? <KeyValue label={i18n.t("app:pet.management.withdrawn")} value={petName(outcome.newPet)} /> : null}
	</Panel>;
	return <>
		<Note>{i18n.t(outcome.isFromShelter ? "app:pet.management.freedShelter" : "app:pet.management.freed", {pet: expeditionPetName(outcome.pet)})}</Note>
		<Panel><KeyValue label={i18n.t("app:pet.care.price")} value={formatMoney(outcome.freeCost)} /></Panel>
		{outcome.luckyMeat ? <Note>{i18n.t("app:pet.management.meat")}</Note> : null}
	</>;
}

export function PetManagementOutcome({outcome, onContinue}: {outcome: Outcome; onContinue: () => void}): ReactNode {
	return <Confirmation title={i18n.t(`app:pet.management.outcomes.${outcome.type}`)} onRequestClose={onContinue}>
		<ManagementResult outcome={outcome} />
		<ButtonRow><Button variant="primary" onPress={onContinue}>{i18n.t("app:common.back")}</Button></ButtonRow>
	</Confirmation>;
}