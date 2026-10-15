import { ReactNode } from "react";
import { CityMobileSnapshot } from "ws-packets/src/fromServer/collectors";
import { Note } from "@/src/design/Primitives";
import { i18n } from "@/src/translations/i18n";
import { gameRules } from "@/src/rules/GameRules";

type CityNoteView = string;
type NoteResolver = (snapshot: CityMobileSnapshot) => string | undefined;

const NOTE_RESOLVERS: Record<string, NoteResolver> = {
	royalBlacksmith: snapshot => snapshot.royalBlacksmith ? i18n.t("app:city.notes.royalBlacksmith") : undefined,
	inn: snapshot => snapshot.inns
		? i18n.t("app:city.notes.inn", {
			mealHours: gameRules().cooldownHours.innMeal, roomHours: gameRules().cooldownHours.innRoom
		})
		: undefined,
	enchanter: snapshot => snapshot.enchanter ? i18n.t("app:city.notes.enchanter") : undefined,
	homeGarden: snapshot => snapshot.home?.owned?.garden ? i18n.t("app:city.notes.garden", { hours: gameRules().cooldownHours.gardenWatering }) : undefined,
	notary: snapshot => snapshot.home?.manage || snapshot.apartmentNotary || snapshot.guildDomainNotary ? i18n.t("app:city.notes.notary") : undefined,
	guild: snapshot => snapshot.guildDomain || snapshot.guildDomainNotary ? i18n.t("app:city.notes.guildDomain") : undefined
};

export function citySnapshotNote(view: CityNoteView, snapshot: CityMobileSnapshot | undefined): ReactNode {
	if (!snapshot) {
		return null;
	}
	const note = NOTE_RESOLVERS[view]?.(snapshot);
	return note ? <Note>{note}</Note> : null;
}
