import { ReactNode } from "react";
import { ApartmentRentRes } from "ws-packets/src/fromServer/home/ApartmentRentRes";
import { AppIcons } from "@/src/AppIcons";
import { Toast } from "@/src/design/Sections";
import { TwemojiIcon } from "@/src/design/TwemojiIcon";
import { formatNumber } from "@/src/display/Amounts";
import { i18n } from "@/src/translations/i18n";

const EMBLEM_SIZE = 22;

/** The rent handed over by the notary, for the apartment it came from. */
export function ApartmentRentOutcome({
	outcome, onContinue
}: {
	outcome: ApartmentRentRes; onContinue: () => void;
}): ReactNode {
	return <Toast
		emblem={<TwemojiIcon emoji={AppIcons.getIcon("city.apartmentNotary.menu")} size={EMBLEM_SIZE} />}
		title={i18n.t("app:city.rent.title")}
		subtitle={i18n.t("app:city.rent.details", { mapLocationId: outcome.mapLocationId })}
		value={{
			amount: i18n.t("app:inventoryActions.gain", { amount: formatNumber(outcome.rent) }), unit: "money"
		}}
		onDismiss={onContinue}
	/>;
}
