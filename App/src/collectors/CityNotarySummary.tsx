import {ReactNode} from "react";
import {CityMobileSnapshot} from "ws-packets/src/fromServer/collectors";
import {formatMoney} from "@/src/collectors/CityText";
import {KeyValue, Panel} from "@/src/design/Primitives";
import {i18n} from "@/src/translations/i18n";

function apartmentPriceSummary(snapshot: CityMobileSnapshot): string | undefined {
	const sale = snapshot.apartmentNotary?.forSale;
	if (!sale) return undefined;
	return sale.canAfford ? formatMoney(sale.price) : i18n.t("app:city.summary.missingMoney", {amount: formatMoney(sale.missingMoney ?? 0)});
}

function notaryRows(snapshot: CityMobileSnapshot): ReactNode[] {
	const manage = snapshot.home?.manage;
	const apartment = snapshot.apartmentNotary;
	const domain = snapshot.guildDomainNotary;
	const apartmentPrice = apartmentPriceSummary(snapshot);
	return [
		manage?.currentMoney !== undefined && <KeyValue key="money" label={i18n.t("app:city.summary.money")} value={formatMoney(manage.currentMoney)} />,
		manage?.upgradePrice !== undefined && <KeyValue key="upgrade" label={i18n.t("app:city.summary.upgradePrice")} value={formatMoney(manage.upgradePrice)} />,
		manage?.newPrice !== undefined && <KeyValue key="purchase" label={i18n.t("app:city.summary.purchasePrice")} value={formatMoney(manage.newPrice)} />,
		manage?.movePrice !== undefined && <KeyValue key="move" label={i18n.t("app:city.summary.movePrice")} value={formatMoney(manage.movePrice)} />,
		apartmentPrice && <KeyValue key="apartment" label={i18n.t("app:city.summary.apartmentPrice")} value={apartmentPrice} />,
		apartment && apartment.ownedCount > 0 && <KeyValue key="rents" label={i18n.t("app:city.summary.rents")} value={`${apartment.ownedCount} · ${formatMoney(apartment.accumulatedRent)}`} />,
		domain && <KeyValue key="domain" label={i18n.t("app:city.summary.domain")} value={domain.hasDomain ? i18n.t("app:common.yes") : i18n.t("app:common.no")} />,
		domain && <KeyValue key="domain-cost" label={i18n.t("app:city.summary.domainCost")} value={formatMoney(domain.cost)} />
	].filter(Boolean) as ReactNode[];
}

export function renderCityNotarySummary(snapshot: CityMobileSnapshot): ReactNode {
	const rows = notaryRows(snapshot);
	return rows.length > 0 ? <Panel>{rows}</Panel> : null;
}
