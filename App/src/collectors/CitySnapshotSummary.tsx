import {ReactNode} from "react";
import {CityMobileSnapshot} from "ws-packets/src/fromServer/collectors";
import {AppIcons} from "@/src/AppIcons";
import {AMOUNT_UNITS, formatMoney, formatNumber} from "@/src/display/Amounts";
import {KeyValue, Panel, StatBar} from "@/src/design/Primitives";
import {Figures} from "@/src/design/Sections";
import {Theme} from "@/src/design/Theme";
import {i18n} from "@/src/translations/i18n";
import {renderCityNotarySummary} from "@/src/collectors/CityNotarySummary";

type CitySubmenu = "home" | "homeBed" | "homeChest" | "homeGarden" | "homeCooking" | "homeUpgrade" | "notary" | "inn" | "enchanter" | "blacksmith" | "scrapDealer" | "royalBlacksmith" | "guild";

type SummaryRenderer = (snapshot: CityMobileSnapshot) => ReactNode;
type OwnedHome = NonNullable<NonNullable<CityMobileSnapshot["home"]>["owned"]>;

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
	return <>
		<Figures items={[
			{caption: i18n.t("app:city.summary.level"), value: formatNumber(home.level)},
			{caption: i18n.t("app:city.summary.bedRegeneration"), value: `+${formatNumber(home.bedHealthRegeneration)}`, unit: "health"},
			{caption: i18n.t("app:city.summary.gardenPlots"), value: formatNumber(home.gardenPlots)}
		]} />
		<Panel>
			<KeyValue label={i18n.t("app:city.summary.homeType")} value={home.isApartment ? i18n.t("app:city.summary.apartment") : i18n.t("app:city.summary.mainHome")} />
			<KeyValue label={i18n.t("app:city.summary.services")} value={homeServices(home)} />
		</Panel>
	</>;
}

function renderHomeBedSummary(snapshot: CityMobileSnapshot): ReactNode {
	const home = snapshot.home?.owned;
	if (!home || !snapshot.health) {
		return null;
	}
	return <>
		<Figures items={[
			{caption: i18n.t("app:city.summary.health"), value: `${formatNumber(snapshot.health.current)} / ${formatNumber(snapshot.health.max)}`, unit: "health"},
			{caption: i18n.t("app:city.summary.bedRegeneration"), value: `+${formatNumber(home.bedHealthRegeneration)}`, unit: "health"}
		]} />
		<Panel>
			<StatBar
				label={i18n.t("app:city.summary.health")}
				value={`${snapshot.health.current} / ${snapshot.health.max} ${AppIcons.getIcon("unitValues.health")}`}
				ratio={snapshot.health.max > 0 ? snapshot.health.current / snapshot.health.max : 0}
				color={Theme.colors.red}
			/>
		</Panel>
	</>;
}

function renderHomeChestSummary(snapshot: CityMobileSnapshot): ReactNode {
	const home = snapshot.home?.owned;
	return home ? <Figures items={[
		{caption: i18n.t("app:city.summary.storedItems"), value: formatNumber(home.chestItemCount ?? 0)},
		{caption: i18n.t("app:city.summary.depositableItems"), value: formatNumber(home.depositableItemCount ?? 0)}
	]} /> : null;
}

function renderHomeCookingSummary(snapshot: CityMobileSnapshot): ReactNode {
	const home = snapshot.home?.owned;
	return home ? <Figures items={[
		{caption: i18n.t("app:city.summary.cooking"), value: formatNumber(home.cookingLevel ?? 0)},
		{caption: i18n.t("app:city.summary.cookingSlots"), value: formatNumber(home.cookingSlots ?? 0)}
	]} /> : null;
}

function renderHomeGardenSummary(snapshot: CityMobileSnapshot): ReactNode {
	const home = snapshot.home?.owned;
	return home ? <Figures items={[
		{caption: i18n.t("app:city.summary.gardenPlots"), value: `${home.gardenReadyPlots ?? 0} / ${home.gardenTotalPlots ?? home.gardenPlots}`},
		{caption: i18n.t("app:city.summary.upgradeableItems"), value: formatNumber(home.upgradeableItemCount)}
	]} /> : null;
}

function renderHomeUpgradeSummary(snapshot: CityMobileSnapshot): ReactNode {
	const home = snapshot.home?.owned;
	return home ? <Figures items={[
		{caption: i18n.t("app:city.summary.level"), value: formatNumber(home.level)},
		{caption: i18n.t("app:city.summary.upgradeableItems"), value: formatNumber(home.upgradeableItemCount)}
	]} /> : null;
}

function renderEnchanterSummary(snapshot: CityMobileSnapshot): ReactNode {
	const data = snapshot.enchanter;
	if (!data) {
		return null;
	}
	const compatibleItemType = data.enchantmentSlot === 0
		? i18n.t("items:weapon", {count: 1})
		: i18n.t("items:armor", {count: 1});
	return <>
		<Figures items={[
			{caption: i18n.t("app:city.summary.price"), value: formatNumber(data.enchantmentCost.money), unit: AMOUNT_UNITS.MONEY},
			{caption: i18n.t("app:city.summary.gems"), value: formatNumber(data.enchantmentCost.gems), unit: AMOUNT_UNITS.GEM},
			{caption: i18n.t("app:city.summary.eligibleItems"), value: formatNumber(data.enchantableItems.length)}
		]} />
		<Panel>
			<KeyValue label={i18n.t("app:city.summary.enchantment")} value={`${AppIcons.getIcon(`enchantmentTypes.${data.enchantmentType}`)} ${i18n.t(`items:enchantments.${data.enchantmentId}`)}`} />
			<KeyValue label={i18n.t("app:city.summary.compatibleWith")} value={compatibleItemType} />
			<KeyValue label={i18n.t("app:city.summary.money")} value={`${formatMoney(data.playerMoney)} · ${data.playerGems} ${AppIcons.getIcon("unitValues.gem")}`} />
			{data.mageReduction ? <KeyValue label={i18n.t("app:city.summary.discount")} value={i18n.t("app:common.yes")} /> : null}
		</Panel>
	</>;
}

function renderBlacksmithSummary(snapshot: CityMobileSnapshot): ReactNode {
	const data = snapshot.blacksmith;
	return data ? <Figures items={[
		{caption: i18n.t("app:city.summary.money"), value: formatNumber(data.playerMoney), unit: AMOUNT_UNITS.MONEY},
		{caption: i18n.t("app:city.summary.upgrades"), value: formatNumber(data.upgradeableItems.length)},
		{caption: i18n.t("app:city.summary.disenchantable"), value: formatNumber(data.disenchantableItems.length)}
	]} /> : null;
}

function renderScrapDealerSummary(snapshot: CityMobileSnapshot): ReactNode {
	const data = snapshot.scrapDealer;
	return data ? <Figures items={[{caption: i18n.t("app:city.summary.recyclableItems"), value: formatNumber(data.recyclableItems.length)}]} /> : null;
}

function renderRoyalBlacksmithSummary(snapshot: CityMobileSnapshot): ReactNode {
	const data = snapshot.royalBlacksmith;
	if (!data) {
		return null;
	}
	return <>
		<Figures items={[
			{caption: i18n.t("app:city.summary.playerLevel"), value: `${formatNumber(data.playerLevel)} / ${formatNumber(data.requiredPlayerLevel)}`},
			{caption: i18n.t("app:city.summary.money"), value: formatNumber(data.playerMoney), unit: AMOUNT_UNITS.MONEY},
			{caption: i18n.t("app:city.summary.gems"), value: formatNumber(data.playerGems), unit: AMOUNT_UNITS.GEM}
		]} />
		<Panel><KeyValue label={i18n.t("app:city.summary.status")} value={i18n.t(`app:city.status.${data.status}`)} /></Panel>
	</>;
}

function renderGuildSummary(snapshot: CityMobileSnapshot): ReactNode {
	if (snapshot.guildDomain) {
		const guild = snapshot.guildDomain;
		return <>
			<Figures items={[
				{caption: i18n.t("app:city.summary.guildLevel"), value: formatNumber(guild.guildLevel)},
				{caption: i18n.t("app:city.summary.treasury"), value: formatNumber(guild.treasury), unit: AMOUNT_UNITS.MONEY},
				{caption: i18n.t("app:city.summary.money"), value: formatNumber(guild.playerMoney), unit: AMOUNT_UNITS.MONEY}
			]} />
			<Panel>
				<KeyValue label={i18n.t("app:city.summary.guild")} value={guild.guildName} />
				<KeyValue label={i18n.t("app:city.summary.buildings")} value={i18n.t("app:city.summary.buildingLevels", {
					shop: guild.shopLevel,
					shelter: guild.shelterLevel,
					pantry: guild.pantryLevel,
					training: guild.trainingGroundLevel
				})} />
				<KeyValue label={i18n.t("app:city.summary.foodStock")} value={i18n.t("app:city.summary.foodStockDetails", guild.food)} />
			</Panel>
		</>;
	}
	const notary = snapshot.guildDomainNotary;
	return notary ? <>
		<Figures items={[
			{caption: i18n.t("app:city.summary.domainCost"), value: formatNumber(notary.cost), unit: AMOUNT_UNITS.MONEY},
			{caption: i18n.t("app:city.summary.treasury"), value: formatNumber(notary.treasury), unit: AMOUNT_UNITS.MONEY}
		]} />
		<Panel><KeyValue label={i18n.t("app:city.summary.domain")} value={notary.hasDomain ? i18n.t("app:common.yes") : i18n.t("app:common.no")} /></Panel>
	</> : null;
}

const SUMMARY_RENDERERS: Partial<Record<CitySubmenu, SummaryRenderer>> = {
	inn: renderInnSummary,
	home: renderHomeSummary,
	homeBed: renderHomeBedSummary,
	homeChest: renderHomeChestSummary,
	homeCooking: renderHomeCookingSummary,
	homeGarden: renderHomeGardenSummary,
	homeUpgrade: renderHomeUpgradeSummary,
	notary: renderCityNotarySummary,
	enchanter: renderEnchanterSummary,
	blacksmith: renderBlacksmithSummary,
	scrapDealer: renderScrapDealerSummary,
	royalBlacksmith: renderRoyalBlacksmithSummary,
	guild: renderGuildSummary
};

export function CitySnapshotSummary({view, snapshot}: {view: CitySubmenu; snapshot?: CityMobileSnapshot}): ReactNode {
	return snapshot ? SUMMARY_RENDERERS[view]?.(snapshot) ?? null : null;
}
