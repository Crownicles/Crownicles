import {ReactNode} from "react";
import {CityMobileSnapshot} from "ws-packets/src/fromServer/collectors";
import {Note} from "@/src/design/Primitives";
import {i18n} from "@/src/translations/i18n";

export function citySnapshotNote(view: string, snapshot: CityMobileSnapshot | undefined): ReactNode {
	if (view === "blacksmith" && snapshot?.blacksmith) {
		const missingMaterials = snapshot.blacksmith.upgradeableItems.some(item => !item.hasAllMaterials);
		return <Note>{missingMaterials
			? `${i18n.t("app:city.notes.blacksmithMissingMaterials")} ${i18n.t("app:city.notes.blacksmith")}`
			: i18n.t("app:city.notes.blacksmith")}</Note>;
	}
	if (view === "scrapDealer" && snapshot?.scrapDealer) {
		return <Note>{i18n.t("app:city.notes.scrapDealer")}</Note>;
	}
	if (view === "royalBlacksmith" && snapshot?.royalBlacksmith) {
		return <Note>{i18n.t("app:city.notes.royalBlacksmith")}</Note>;
	}
	if (view === "inn" && snapshot?.inns) {
		return <Note>{i18n.t("app:city.notes.inn")}</Note>;
	}
	if (view === "enchanter" && snapshot?.enchanter) {
		return <Note>{i18n.t("app:city.notes.enchanter")}</Note>;
	}
	if (view === "homeGarden" && snapshot?.home?.owned?.garden) {
		return <Note>{i18n.t("app:city.notes.garden")}</Note>;
	}
	if (view === "homeChest" && snapshot?.home?.owned?.hasChest) {
		return <Note>{i18n.t("app:city.notes.chest")}</Note>;
	}
	if (view === "homeCooking" && snapshot?.home?.owned?.hasCooking) {
		return <Note>{i18n.t("app:city.notes.cooking")}</Note>;
	}
	if (view === "notary" && (snapshot?.home?.manage || snapshot?.apartmentNotary || snapshot?.guildDomainNotary)) {
		return <Note>{i18n.t("app:city.notes.notary")}</Note>;
	}
	if (view === "guild" && (snapshot?.guildDomain || snapshot?.guildDomainNotary)) {
		return <Note>{i18n.t("app:city.notes.guildDomain")}</Note>;
	}
	return null;
}
