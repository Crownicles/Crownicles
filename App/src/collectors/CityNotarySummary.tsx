import {ReactNode} from "react";
import {CityMobileSnapshot} from "ws-packets/src/fromServer/collectors";
import {AppIcons} from "@/src/AppIcons";
import {KeyValue, Panel} from "@/src/design/Primitives";
import {i18n} from "@/src/translations/i18n";

function formatMoney(value: number): string {
	return `${value.toLocaleString("fr-FR")} ${AppIcons.getIcon("unitValues.money")}`;
}

// @codescene(disable:"Complex Method", disable:"Complex Conditional")
export function renderCityNotarySummary(snapshot: CityMobileSnapshot): ReactNode {
	const manage = snapshot.home?.manage;
	const apartment = snapshot.apartmentNotary;
	const sale = apartment?.forSale;
	const domain = snapshot.guildDomainNotary;
	const apartmentPrice = sale
		? sale.canAfford
			? formatMoney(sale.price)
			: i18n.t("app:city.summary.missingMoney", {amount: formatMoney(sale.missingMoney ?? 0)})
		: undefined;
	const rows = [
		manage?.currentMoney !== undefined && <KeyValue key="money" label={i18n.t("app:city.summary.money")} value={formatMoney(manage.currentMoney)} />,
		manage?.upgradePrice !== undefined && <KeyValue key="upgrade" label={i18n.t("app:city.summary.upgradePrice")} value={formatMoney(manage.upgradePrice)} />,
		manage?.newPrice !== undefined && <KeyValue key="purchase" label={i18n.t("app:city.summary.purchasePrice")} value={formatMoney(manage.newPrice)} />,
		manage?.movePrice !== undefined && <KeyValue key="move" label={i18n.t("app:city.summary.movePrice")} value={formatMoney(manage.movePrice)} />,
		apartmentPrice && <KeyValue key="apartment" label={i18n.t("app:city.summary.apartmentPrice")} value={apartmentPrice} />,
		apartment && apartment.ownedCount > 0 && <KeyValue key="rents" label={i18n.t("app:city.summary.rents")} value={`${apartment.ownedCount} · ${formatMoney(apartment.accumulatedRent)}`} />,
		domain && <KeyValue key="domain" label={i18n.t("app:city.summary.domain")} value={domain.hasDomain ? i18n.t("app:common.yes") : i18n.t("app:common.no")} />,
		domain && <KeyValue key="domain-cost" label={i18n.t("app:city.summary.domainCost")} value={formatMoney(domain.cost)} />
	].filter(Boolean) as ReactNode[];
	return rows.length > 0 ? <Panel>{rows}</Panel> : null;
}
