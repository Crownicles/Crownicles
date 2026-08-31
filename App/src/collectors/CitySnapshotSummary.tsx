import {ReactNode} from "react";
import {CityMobileSnapshot} from "ws-packets/src/fromServer/collectors";
import {AppIcons} from "@/src/AppIcons";
import {KeyValue, Panel, StatBar} from "@/src/design/Primitives";
import {Theme} from "@/src/design/Theme";
import {i18n} from "@/src/translations/i18n";

type CitySubmenu = "home" | "homeBed" | "homeChest" | "homeGarden" | "homeCooking" | "homeUpgrade" | "notary" | "inn" | "enchanter" | "blacksmith" | "scrapDealer" | "royalBlacksmith" | "guild";

type SummaryRenderer = (snapshot: CityMobileSnapshot) => ReactNode;
type OwnedHome = NonNullable<NonNullable<CityMobileSnapshot["home"]>["owned"]>;

function formatMoney(value: number): string {
	return `${value.toLocaleString("fr-FR")} ${AppIcons.getIcon("unitValues.money")}`;
}

function homeServices(home: OwnedHome): string {
	return [
		home.hasBed ? i18n.t("app:city.summary.bed") : null,
		home.hasChest ? i18n.t("app:city.summary.chest") : null,
		home.hasGarden ? i18n.t("app:city.summary.garden") : null,
		home.hasCooking ? i18n.t("app:city.summary.cooking") : null,
		home.hasUpgradeStation ? i18n.t("app:city.summary.forge") : null
	].filter(Boolean).join(" · ") || "—";
}

function renderInnSummary(snapshot: CityMobileSnapshot): ReactNode {
	if (!snapshot.energy || !snapshot.health) {
		return null;
	}
	return <Panel>
		<StatBar
			label={i18n.t("app:city.summary.energy")}
			value={`${snapshot.energy.current} / ${snapshot.energy.max} ${AppIcons.getIcon("unitValues.energy")}`}
			ratio={snapshot.energy.max > 0 ? snapshot.energy.current / snapshot.energy.max : 0}
			color={Theme.colors.green}
		/>
		<StatBar
			label={i18n.t("app:city.summary.health")}
			value={`${snapshot.health.current} / ${snapshot.health.max} ${AppIcons.getIcon("unitValues.health")}`}
			ratio={snapshot.health.max > 0 ? snapshot.health.current / snapshot.health.max : 0}
			color={Theme.colors.red}
		/>
	</Panel>;
}

function renderHomeSummary(snapshot: CityMobileSnapshot): ReactNode {
	const home = snapshot.home?.owned;
	if (!home) {
		return null;
	}
	return <Panel>
		<KeyValue label={i18n.t("app:city.summary.homeType")} value={home.isApartment ? i18n.t("app:city.summary.apartment") : i18n.t("app:city.summary.mainHome")} />
		<KeyValue label={i18n.t("app:city.summary.level")} value={String(home.level)} />
		<KeyValue label={i18n.t("app:city.summary.cooking")} value={home.cookingLevel === undefined ? "—" : String(home.cookingLevel)} />
		<KeyValue label={i18n.t("app:city.summary.bedRegeneration")} value={`+${home.bedHealthRegeneration} ${AppIcons.getIcon("unitValues.health")}`} />
		<KeyValue label={i18n.t("app:city.summary.gardenPlots")} value={String(home.gardenPlots)} />
		<KeyValue label={i18n.t("app:city.summary.upgradeableItems")} value={String(home.upgradeableItemCount)} />
		<KeyValue label={i18n.t("app:city.summary.services")} value={homeServices(home)} />
	</Panel>;
}

function renderHomeBedSummary(snapshot: CityMobileSnapshot): ReactNode {
	const home = snapshot.home?.owned;
	if (!home || !snapshot.health) {
		return null;
	}
	return <Panel>
		<StatBar
			label={i18n.t("app:city.summary.health")}
			value={`${snapshot.health.current} / ${snapshot.health.max} ${AppIcons.getIcon("unitValues.health")}`}
			ratio={snapshot.health.max > 0 ? snapshot.health.current / snapshot.health.max : 0}
			color={Theme.colors.red}
		/>
		<KeyValue label={i18n.t("app:city.summary.bedRegeneration")} value={`+${home.bedHealthRegeneration} ${AppIcons.getIcon("unitValues.health")}`} />
		<KeyValue label={i18n.t("app:city.summary.available")} value={snapshot.health.current < snapshot.health.max ? i18n.t("app:common.yes") : i18n.t("app:city.summary.fullHealth")} />
	</Panel>;
}

function renderHomeChestSummary(snapshot: CityMobileSnapshot): ReactNode {
	const home = snapshot.home?.owned;
	return home ? <Panel>
		<KeyValue label={i18n.t("app:city.summary.storedItems")} value={String(home.chestItemCount ?? 0)} />
		<KeyValue label={i18n.t("app:city.summary.depositableItems")} value={String(home.depositableItemCount ?? 0)} />
	</Panel> : null;
}

function renderHomeCookingSummary(snapshot: CityMobileSnapshot): ReactNode {
	const home = snapshot.home?.owned;
	return home ? <Panel>
		<KeyValue label={i18n.t("app:city.summary.cooking")} value={String(home.cookingLevel ?? 0)} />
		<KeyValue label={i18n.t("app:city.summary.cookingSlots")} value={String(home.cookingSlots ?? 0)} />
		<KeyValue label={i18n.t("app:city.summary.cookingStatus")} value={i18n.t("app:city.summary.cookingStatusUnavailable")} />
	</Panel> : null;
}

function renderHomeGardenSummary(snapshot: CityMobileSnapshot): ReactNode {
	const home = snapshot.home?.owned;
	return home ? <Panel>
		<KeyValue label={i18n.t("app:city.summary.gardenPlots")} value={`${home.gardenReadyPlots ?? 0} / ${home.gardenTotalPlots ?? home.gardenPlots}`} />
		<KeyValue label={i18n.t("app:city.summary.upgradeableItems")} value={String(home.upgradeableItemCount)} />
	</Panel> : null;
}

function renderHomeUpgradeSummary(snapshot: CityMobileSnapshot): ReactNode {
	const home = snapshot.home?.owned;
	return home ? <Panel>
		<KeyValue label={i18n.t("app:city.summary.level")} value={String(home.level)} />
		<KeyValue label={i18n.t("app:city.summary.upgradeableItems")} value={String(home.upgradeableItemCount)} />
	</Panel> : null;
}

function notaryRows(snapshot: CityMobileSnapshot): ReactNode[] {
	const manage = snapshot.home?.manage;
	const apartment = snapshot.apartmentNotary;
	const rows: ReactNode[] = [];
	if (manage?.currentMoney !== undefined) {
		rows.push(<KeyValue key="money" label={i18n.t("app:city.summary.money")} value={formatMoney(manage.currentMoney)} />);
	}
	if (manage?.upgradePrice !== undefined) {
		rows.push(<KeyValue key="upgrade" label={i18n.t("app:city.summary.upgradePrice")} value={formatMoney(manage.upgradePrice)} />);
	}
	if (manage?.newPrice !== undefined) {
		rows.push(<KeyValue key="purchase" label={i18n.t("app:city.summary.purchasePrice")} value={formatMoney(manage.newPrice)} />);
	}
	if (manage?.movePrice !== undefined) {
		rows.push(<KeyValue key="move" label={i18n.t("app:city.summary.movePrice")} value={formatMoney(manage.movePrice)} />);
	}
	if (apartment?.forSale) {
		const value = apartment.forSale.canAfford
			? formatMoney(apartment.forSale.price)
			: i18n.t("app:city.summary.missingMoney", {amount: formatMoney(apartment.forSale.missingMoney ?? 0)});
		rows.push(<KeyValue key="apartment" label={i18n.t("app:city.summary.apartmentPrice")} value={value} />);
	}
	if (apartment && apartment.ownedCount > 0) {
		rows.push(<KeyValue key="rents" label={i18n.t("app:city.summary.rents")} value={`${apartment.ownedCount} · ${formatMoney(apartment.accumulatedRent)}`} />);
	}
	if (snapshot.guildDomainNotary) {
		rows.push(<KeyValue key="domain" label={i18n.t("app:city.summary.domain")} value={snapshot.guildDomainNotary.hasDomain ? i18n.t("app:common.yes") : i18n.t("app:common.no")} />);
		rows.push(<KeyValue key="domain-cost" label={i18n.t("app:city.summary.domainCost")} value={formatMoney(snapshot.guildDomainNotary.cost)} />);
	}
	return rows;
}

function renderNotarySummary(snapshot: CityMobileSnapshot): ReactNode {
	const rows = notaryRows(snapshot);
	return rows.length > 0 ? <Panel>{rows}</Panel> : null;
}

function renderEnchanterSummary(snapshot: CityMobileSnapshot): ReactNode {
	const data = snapshot.enchanter;
	if (!data) {
		return null;
	}
	const compatibleItemType = data.enchantmentSlot === 0
		? i18n.t("items:weapon", {count: 1})
		: i18n.t("items:armor", {count: 1});
	return <Panel>
		<KeyValue label={i18n.t("app:city.summary.enchantment")} value={`${AppIcons.getIcon(`enchantmentTypes.${data.enchantmentType}`)} ${i18n.t(`items:enchantments.${data.enchantmentId}`)}`} />
		<KeyValue label={i18n.t("app:city.summary.compatibleWith")} value={compatibleItemType} />
		<KeyValue label={i18n.t("app:city.summary.price")} value={`${formatMoney(data.enchantmentCost.money)} · ${data.enchantmentCost.gems} ${AppIcons.getIcon("unitValues.gem")}`} />
		<KeyValue label={i18n.t("app:city.summary.money")} value={`${formatMoney(data.playerMoney)} · ${data.playerGems} ${AppIcons.getIcon("unitValues.gem")}`} />
		<KeyValue label={i18n.t("app:city.summary.discount")} value={data.mageReduction ? i18n.t("app:common.yes") : i18n.t("app:common.no")} />
		<KeyValue label={i18n.t("app:city.summary.eligibleItems")} value={String(data.enchantableItems.length)} />
	</Panel>;
}

function renderBlacksmithSummary(snapshot: CityMobileSnapshot): ReactNode {
	const data = snapshot.blacksmith;
	return data ? <Panel>
		<KeyValue label={i18n.t("app:city.summary.money")} value={formatMoney(data.playerMoney)} />
		<KeyValue label={i18n.t("app:city.summary.upgrades")} value={String(data.upgradeableItems.length)} />
		<KeyValue label={i18n.t("app:city.summary.disenchantable")} value={String(data.disenchantableItems.length)} />
	</Panel> : null;
}

function renderScrapDealerSummary(snapshot: CityMobileSnapshot): ReactNode {
	const data = snapshot.scrapDealer;
	return data ? <Panel><KeyValue label={i18n.t("app:city.summary.recyclableItems")} value={String(data.recyclableItems.length)} /></Panel> : null;
}

function renderRoyalBlacksmithSummary(snapshot: CityMobileSnapshot): ReactNode {
	const data = snapshot.royalBlacksmith;
	if (!data) {
		return null;
	}
	return <Panel>
		<KeyValue label={i18n.t("app:city.summary.status")} value={i18n.t(`app:city.status.${data.status}`)} />
		<KeyValue label={i18n.t("app:city.summary.requiredPlayerLevel")} value={String(data.requiredPlayerLevel)} />
		<KeyValue label={i18n.t("app:city.summary.playerLevel")} value={String(data.playerLevel)} />
		<KeyValue label={i18n.t("app:city.summary.money")} value={formatMoney(data.playerMoney)} />
		<KeyValue label={i18n.t("app:city.summary.gems")} value={`${data.playerGems} ${AppIcons.getIcon("unitValues.gem")}`} />
	</Panel>;
}

function renderGuildSummary(snapshot: CityMobileSnapshot): ReactNode {
	if (snapshot.guildDomain) {
		const guild = snapshot.guildDomain;
		return <Panel>
			<KeyValue label={i18n.t("app:city.summary.guild")} value={guild.guildName} />
			<KeyValue label={i18n.t("app:city.summary.guildLevel")} value={String(guild.guildLevel)} />
			<KeyValue label={i18n.t("app:city.summary.treasury")} value={formatMoney(guild.treasury)} />
			<KeyValue label={i18n.t("app:city.summary.money")} value={formatMoney(guild.playerMoney)} />
			<KeyValue label={i18n.t("app:city.summary.buildings")} value={i18n.t("app:city.summary.buildingLevels", {
				shop: guild.shopLevel,
				shelter: guild.shelterLevel,
				pantry: guild.pantryLevel,
				training: guild.trainingGroundLevel
			})} />
			<KeyValue label={i18n.t("app:city.summary.foodStock")} value={i18n.t("app:city.summary.foodStockDetails", guild.food)} />
		</Panel>;
	}
	const notary = snapshot.guildDomainNotary;
	return notary ? <Panel>
		<KeyValue label={i18n.t("app:city.summary.domain")} value={notary.hasDomain ? i18n.t("app:common.yes") : i18n.t("app:common.no")} />
		<KeyValue label={i18n.t("app:city.summary.domainCost")} value={formatMoney(notary.cost)} />
		<KeyValue label={i18n.t("app:city.summary.treasury")} value={formatMoney(notary.treasury)} />
	</Panel> : null;
}

const SUMMARY_RENDERERS: Partial<Record<CitySubmenu, SummaryRenderer>> = {
	inn: renderInnSummary,
	home: renderHomeSummary,
	homeBed: renderHomeBedSummary,
	homeChest: renderHomeChestSummary,
	homeCooking: renderHomeCookingSummary,
	homeGarden: renderHomeGardenSummary,
	homeUpgrade: renderHomeUpgradeSummary,
	notary: renderNotarySummary,
	enchanter: renderEnchanterSummary,
	blacksmith: renderBlacksmithSummary,
	scrapDealer: renderScrapDealerSummary,
	royalBlacksmith: renderRoyalBlacksmithSummary,
	guild: renderGuildSummary
};

export function CitySnapshotSummary({view, snapshot}: {view: CitySubmenu; snapshot?: CityMobileSnapshot}): ReactNode {
	return snapshot ? SUMMARY_RENDERERS[view]?.(snapshot) ?? null : null;
}
