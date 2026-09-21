import {ReactNode} from "react";
import {CityMobileSnapshot} from "ws-packets/src/fromServer/collectors";
import {AMOUNT_UNITS, formatNumber} from "@/src/display/Amounts";
import {Figure, Figures} from "@/src/design/Sections";
import {i18n} from "@/src/translations/i18n";

/** Prices and refusals live on their own action rows, so the notary only opens on what he holds. */
function notaryFigures(snapshot: CityMobileSnapshot): Figure[] {
	const apartment = snapshot.apartmentNotary;
	const money = snapshot.home?.manage?.currentMoney;
	return [
		...money === undefined ? [] : [{caption: i18n.t("app:city.summary.money"), value: formatNumber(money), unit: AMOUNT_UNITS.MONEY}],
		...apartment && apartment.ownedCount > 0
			? [
				{caption: i18n.t("app:city.summary.apartments"), value: formatNumber(apartment.ownedCount)},
				{caption: i18n.t("app:city.summary.rents"), value: formatNumber(apartment.accumulatedRent), unit: AMOUNT_UNITS.MONEY}
			]
			: []
	];
}

export function renderCityNotarySummary(snapshot: CityMobileSnapshot): ReactNode {
	const figures = notaryFigures(snapshot);
	return figures.length > 0 ? <Figures items={figures} /> : null;
}
