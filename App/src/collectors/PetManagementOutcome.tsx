import {ReactNode} from "react";
import {PetFreeStatus, PetManagementOutcome as Outcome} from "ws-packets/src/objects/PetManagement";
import {Note} from "@/src/design/Primitives";
import {formatMoney} from "@/src/display/Amounts";
import {formatDurationMinutes} from "@/src/display/ItemEffects";
import {petName} from "@/src/display/PetDisplay";
import {expeditionPetName} from "@/src/display/PetExpedition";
import {i18n} from "@/src/translations/i18n";
import {ExpandableList, Fact, Sheet} from "@/src/design/Sections";

const MILLISECONDS_PER_MINUTE = 60_000;
function statusMessage(status: PetFreeStatus): string {
	if (!status.foundPet) return i18n.t("app:pet.noPet");
	if (status.petOnExpedition) return i18n.t("app:pet.feed.errors.expedition");
	if (status.cooldownRemainingTimeMs) return i18n.t("app:pet.management.cooldown", {duration: formatDurationMinutes(status.cooldownRemainingTimeMs / MILLISECONDS_PER_MINUTE)});
	if (status.missingMoney) return i18n.t("app:pet.management.missingMoney", {money: formatMoney(status.missingMoney)});
	return i18n.t(status.petCanBeFreed ? "app:pet.management.available" : "app:pet.management.errors.changed");
}

function FreedPetResult({outcome}: {outcome: Extract<Outcome, {type: "freed"}>}): ReactNode {
	return <>
		<Note>{i18n.t(outcome.isFromShelter ? "app:pet.management.freedShelter" : "app:pet.management.freed", {pet: expeditionPetName(outcome.pet)})}</Note>
		<Fact label={i18n.t("app:pet.care.price")} value={formatMoney(outcome.freeCost)} />
		{outcome.luckyMeat ? <Note>{i18n.t("app:pet.management.meat")}</Note> : null}
	</>;
}

function ManagementResult({outcome}: {outcome: Outcome}): ReactNode {
	if (outcome.type === "error") return <Note>{i18n.t(`app:pet.management.errors.${outcome.error}`)}</Note>;
	if (outcome.type === "freeStatus") return <Note>{statusMessage(outcome.status)}</Note>;
	if (outcome.type === "salePrice") return <Note>{i18n.t("app:pet.sale.badPrice", {min: formatMoney(outcome.minPrice), max: formatMoney(outcome.maxPrice)})}</Note>;
	if (outcome.type === "saleFunds") return <Note>{i18n.t("app:pet.sale.missingMoney", {money: formatMoney(outcome.missingMoney)})}</Note>;
	if (outcome.type === "sold") return <>
		<Note>{i18n.t("app:pet.sale.sold", {pet: petName(outcome.pet)})}</Note>
		<Fact label={i18n.t("app:pet.sale.treasury", {guild: outcome.guildName})} value={formatMoney(outcome.treasuryEarned)} />
	</>;
	if (outcome.type === "transfer") return <>
		{outcome.oldPet ? <Fact label={i18n.t("app:pet.management.deposited")} value={petName(outcome.oldPet)} /> : null}
		{outcome.newPet ? <Fact label={i18n.t("app:pet.management.withdrawn")} value={petName(outcome.newPet)} /> : null}
	</>;
	return <FreedPetResult outcome={outcome} />;
}

export function PetManagementOutcome({outcome, onContinue}: {outcome: Outcome; onContinue: () => void}): ReactNode {
	return <Sheet
		caption={i18n.t("app:pet.eyebrow")}
		title={i18n.t(`app:pet.management.outcomes.${outcome.type}`)}
		closeLabel={i18n.t("app:common.back")}
		onClose={onContinue}
	>
		<ExpandableList><ManagementResult outcome={outcome} /></ExpandableList>
	</Sheet>;
}