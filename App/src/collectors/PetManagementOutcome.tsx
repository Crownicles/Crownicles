import {ReactNode} from "react";
import {FromServerPacket} from "ws-packets/src/fromServer/FromServerPacket";
import {PetManagementRes} from "ws-packets/src/fromServer/pet/PetManagementRes";
import {PetFreeStatus, PetManagementOutcome as Outcome} from "ws-packets/src/objects/PetManagement";
import {Note} from "@/src/design/Primitives";
import {formatMoney} from "@/src/display/Amounts";
import {formatDurationMinutes} from "@/src/display/ItemEffects";
import {petIcon, petName} from "@/src/display/PetDisplay";
import {expeditionPetIcon, expeditionPetName} from "@/src/display/PetExpedition";
import {i18n} from "@/src/translations/i18n";
import {ActionBanner, ExpandableList, Fact, QuestionSheet, Toast} from "@/src/design/Sections";
import {Check} from "@/src/design/FightIcons";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";

const TOAST_EMBLEM_SIZE = 24;

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
		<ExpandableList><Fact label={i18n.t("app:pet.care.price")} value={formatMoney(outcome.freeCost)} /></ExpandableList>
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

/** What is said in passing: a refusal, a status, or a sale the guild's treasury already shows. */
function passingNote(outcome: Outcome): string | null {
	const refusal = petManagementRefusal(outcome);
	if (refusal !== null) return refusal;
	if (outcome.type === "freeStatus") return statusMessage(outcome.status);
	return outcome.type === "sold" ? formatMoney(outcome.treasuryEarned) : null;
}

type TransferOutcome = Extract<Outcome, {type: "transfer"}>;

function transferTitle(outcome: TransferOutcome): string {
	if (outcome.oldPet && outcome.newPet) return i18n.t("app:pet.management.switched", {oldPet: petName(outcome.oldPet), newPet: petName(outcome.newPet)});
	return outcome.newPet
		? i18n.t("app:pet.management.withdrawnToast", {pet: petName(outcome.newPet)})
		: i18n.t("app:pet.management.depositedToast", {pet: outcome.oldPet ? petName(outcome.oldPet) : ""});
}

/** A transfer is acknowledged in passing: the shelter already shows where each pet went. */
function TransferToast({outcome, onContinue}: {outcome: TransferOutcome; onContinue: () => void}): ReactNode {
	const pet = outcome.newPet ?? outcome.oldPet;
	return <Toast
		{...pet ? {emblem: <TwemojiIcon emoji={petIcon(pet)} size={TOAST_EMBLEM_SIZE} />} : {}}
		title={transferTitle(outcome)}
		onDismiss={onContinue}
	/>;
}

export function PetManagementOutcome({outcome, onContinue}: {outcome: Outcome; onContinue: () => void}): ReactNode {
	if (outcome.type === "transfer") return <TransferToast outcome={outcome} onContinue={onContinue} />;
	if (outcome.type === "freed") return <QuestionSheet
		caption={i18n.t("app:pet.eyebrow")}
		title={i18n.t("app:pet.management.outcomes.freed")}
		emblem={<TwemojiIcon emoji={expeditionPetIcon(outcome.pet)} size={TOAST_EMBLEM_SIZE} />}
		onClose={onContinue}
	>
		<FreedPetResult outcome={outcome} />
		<ActionBanner icon={Check} label={i18n.t("app:common.continue")} onPress={onContinue} />
	</QuestionSheet>;
	const note = passingNote(outcome);
	return <Toast
		title={outcome.type === "sold" ? i18n.t("app:pet.sale.sold", {pet: petName(outcome.pet)}) : i18n.t(`app:pet.management.outcomes.${outcome.type}`)}
		{...note ? {subtitle: note} : {}}
		onDismiss={onContinue}
	/>;
}