import {ReactNode} from "react";
import {FromServerPacket} from "ws-packets/src/fromServer/FromServerPacket";
import {PetManagementRes} from "ws-packets/src/fromServer/pet/PetManagementRes";
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

/** How long a newcomer still waits before taking a pet out of the shelter. */
export function probationMessage(probationEndsAt: number): string {
	return i18n.t("app:pet.management.probation", {duration: formatDurationMinutes((probationEndsAt - Date.now()) / MILLISECONDS_PER_MINUTE)});
}

/** Why Core turned a request down, or null when the outcome is a result worth its own sheet. */
export function petManagementRefusal(outcome: Outcome): string | null {
	if (outcome.type === "error") return i18n.t(`app:pet.management.errors.${outcome.error}`);
	if (outcome.type === "probation") return probationMessage(outcome.probationEndsAt);
	if (outcome.type === "salePrice") return i18n.t("app:pet.sale.badPrice", {min: formatMoney(outcome.minPrice), max: formatMoney(outcome.maxPrice)});
	return outcome.type === "saleFunds" ? i18n.t("app:pet.sale.missingMoney", {money: formatMoney(outcome.missingMoney)}) : null;
}

/** The refusal a pet management menu reads from its outcome packet. */
export function petManagementPacketRefusal(packet: FromServerPacket): string | null {
	return petManagementRefusal((packet as PetManagementRes).outcome);
}

function ManagementResult({outcome}: {outcome: Outcome}): ReactNode {
	const refusal = petManagementRefusal(outcome);
	if (refusal !== null) return <Note>{refusal}</Note>;
	if (outcome.type === "freeStatus") return <Note>{statusMessage(outcome.status)}</Note>;
	if (outcome.type === "sold") return <>
		<Note>{i18n.t("app:pet.sale.sold", {pet: petName(outcome.pet)})}</Note>
		<Fact label={i18n.t("app:pet.sale.treasury", {guild: outcome.guildName})} value={formatMoney(outcome.treasuryEarned)} />
	</>;
	if (outcome.type === "transfer") return <>
		{outcome.oldPet ? <Fact label={i18n.t("app:pet.management.deposited")} value={petName(outcome.oldPet)} /> : null}
		{outcome.newPet ? <Fact label={i18n.t("app:pet.management.withdrawn")} value={petName(outcome.newPet)} /> : null}
	</>;
	return outcome.type === "freed" ? <FreedPetResult outcome={outcome} /> : null;
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