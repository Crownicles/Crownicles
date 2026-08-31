import {ReactNode} from "react";
import {CityMobileSnapshot} from "ws-packets/src/fromServer/collectors";
import {Note} from "@/src/design/Primitives";
import {i18n} from "@/src/translations/i18n";

type CityNoteView = string;
type NoteResolver = (snapshot: CityMobileSnapshot) => string | undefined;

function blacksmithNote(snapshot: CityMobileSnapshot): string {
	const missingMaterials = snapshot.blacksmith?.upgradeableItems.some(item => !item.hasAllMaterials) ?? false;
	return missingMaterials ? `${i18n.t("app:city.notes.blacksmithMissingMaterials")} ${i18n.t("app:city.notes.blacksmith")}` : i18n.t("app:city.notes.blacksmith");
}

const NOTE_RESOLVERS: Record<string, NoteResolver> = {
	blacksmith: snapshot => snapshot.blacksmith ? blacksmithNote(snapshot) : undefined,
	scrapDealer: snapshot => snapshot.scrapDealer ? i18n.t("app:city.notes.scrapDealer") : undefined,
	royalBlacksmith: snapshot => snapshot.royalBlacksmith ? i18n.t("app:city.notes.royalBlacksmith") : undefined,
	inn: snapshot => snapshot.inns ? i18n.t("app:city.notes.inn") : undefined,
	enchanter: snapshot => snapshot.enchanter ? i18n.t("app:city.notes.enchanter") : undefined,
	homeGarden: snapshot => snapshot.home?.owned?.garden ? i18n.t("app:city.notes.garden") : undefined,
	homeChest: snapshot => snapshot.home?.owned?.hasChest ? i18n.t("app:city.notes.chest") : undefined,
	homeCooking: snapshot => snapshot.home?.owned?.hasCooking ? i18n.t("app:city.notes.cooking") : undefined,
	notary: snapshot => snapshot.home?.manage || snapshot.apartmentNotary || snapshot.guildDomainNotary ? i18n.t("app:city.notes.notary") : undefined,
	guild: snapshot => snapshot.guildDomain || snapshot.guildDomainNotary ? i18n.t("app:city.notes.guildDomain") : undefined
};

export function citySnapshotNote(view: CityNoteView, snapshot: CityMobileSnapshot | undefined): ReactNode {
	if (!snapshot) return null;
	const note = NOTE_RESOLVERS[view]?.(snapshot);
	return note ? <Note>{note}</Note> : null;
}
