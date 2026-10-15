import { ReactNode } from "react";
import { CityMobileSnapshot } from "ws-packets/src/fromServer/collectors";
import { AppIcons } from "@/src/AppIcons";
import {
	AMOUNT_UNITS, formatMoney, formatNumber
} from "@/src/display/Amounts";
import {
	ExpandableList, Fact, Figure, Figures, Gauge
} from "@/src/design/Sections";
import { i18n } from "@/src/translations/i18n";
import { plantName } from "@/src/display/Resources";
import { renderCityNotarySummary } from "@/src/collectors/CityNotarySummary";
import { useColors } from "@/src/design/ThemeContext";
import type { Palette } from "@/src/design/Theme";

type CitySubmenu = "home" | "homeBed" | "homeChest" | "homeGarden" | "homeCooking" | "homeUpgrade" | "notary" | "inn" | "enchanter" | "blacksmith" | "scrapDealer" | "royalBlacksmith" | "guild";

type SummaryRenderer = (snapshot: CityMobileSnapshot, colors: Palette) => ReactNode;
type OwnedHome = NonNullable<NonNullable<CityMobileSnapshot["home"]>["owned"]>;

function renderInnSummary(snapshot: CityMobileSnapshot, colors: Palette): ReactNode {
	if (!snapshot.energy || !snapshot.health) {
		return null;
	}
	return <ExpandableList>
		<Gauge
			label={i18n.t("app:city.summary.energy")}
			value={`${snapshot.energy.current} / ${snapshot.energy.max} ${AppIcons.getIcon("unitValues.energy")}`}
			ratio={snapshot.energy.max > 0 ? snapshot.energy.current / snapshot.energy.max : 0}
			color={colors.green}
		/>
		<Gauge
			label={i18n.t("app:city.summary.health")}
			value={`${snapshot.health.current} / ${snapshot.health.max} ${AppIcons.getIcon("unitValues.health")}`}
			ratio={snapshot.health.max > 0 ? snapshot.health.current / snapshot.health.max : 0}
			color={colors.red}
		/>
	</ExpandableList>;
}

/** The home itself; each room tells its own figures on its row below. */
function renderHomeSummary(snapshot: CityMobileSnapshot): ReactNode {
	const home = snapshot.home?.owned;
	if (!home) {
		return null;
	}
	return <Figures items={[
		{
			caption: i18n.t("app:city.summary.level"), value: formatNumber(home.level)
		},
		{
			caption: i18n.t("app:city.summary.homeType"), value: home.isApartment ? i18n.t("app:city.summary.apartment") : i18n.t("app:city.summary.mainHome")
		}
	]} />;
}

/** Where the player's health stands and where a rest would take it; the bed's own gain is on its row. */
function renderHomeBedSummary(snapshot: CityMobileSnapshot): ReactNode {
	const home = snapshot.home?.owned;
	if (!home || !snapshot.health) {
		return null;
	}
	const rested = Math.min(snapshot.health.max, snapshot.health.current + home.bedHealthRegeneration);
	return <Figures items={[
		{
			caption: i18n.t("app:city.summary.health"), value: `${formatNumber(snapshot.health.current)} / ${formatNumber(snapshot.health.max)}`, unit: "health"
		},
		{
			caption: i18n.t("app:city.bed.afterRest"), value: `${formatNumber(rested)} / ${formatNumber(snapshot.health.max)}`, unit: "health"
		}
	]} />;
}

/** A home room sums itself up in two figures, shown only to the owner. */
function homeSummary(figures: (home: OwnedHome) => Figure[]): SummaryRenderer {
	return function homeRoomSummary(snapshot: CityMobileSnapshot): ReactNode {
		const home = snapshot.home?.owned;
		return home ? <Figures items={figures(home)} /> : null;
	};
}

/** The remote garden: what is ripe for the harvest, and the seed that waits for the trip home. */
const renderHomeGardenSummary = homeSummary(home => [
	{
		caption: i18n.t("app:garden.ready"), value: `${home.gardenReadyPlots ?? 0} / ${home.gardenTotalPlots ?? home.gardenPlots}`
	},
	{
		caption: i18n.t("app:inventory.seed"), value: home.garden?.hasSeed ? plantName(home.garden.seedPlantId) : i18n.t("app:profile.values.none")
	}
]);

/** What the station can take on, so a refused item is understood before it is touched; the list says the rest. */
const renderHomeUpgradeSummary = homeSummary(home => home.upgradeStation
	? [
		{
			caption: i18n.t("app:city.station.maxLevel"), value: formatNumber(home.upgradeStation.maxItemLevel)
		},
		{
			caption: i18n.t("app:city.station.maxRarity"), value: i18n.t(`items:raritiesWithoutEmote.${home.upgradeStation.maxRarity}`)
		}
	]
	: [
		{
			caption: i18n.t("app:city.summary.level"), value: formatNumber(home.level)
		},
		{
			caption: i18n.t("app:city.summary.upgradeableItems"), value: formatNumber(home.upgradeableItemCount)
		}
	]);

function renderEnchanterSummary(snapshot: CityMobileSnapshot): ReactNode {
	const data = snapshot.enchanter;
	if (!data) {
		return null;
	}
	const compatibleItemType = data.enchantmentSlot === 0
		? i18n.t("items:weapon", { count: 1 })
		: i18n.t("items:armor", { count: 1 });
	return <>
		<Figures items={[
			{
				caption: i18n.t("app:city.summary.price"), value: formatNumber(data.enchantmentCost.money), unit: AMOUNT_UNITS.MONEY
			},
			{
				caption: i18n.t("app:city.summary.gems"), value: formatNumber(data.enchantmentCost.gems), unit: AMOUNT_UNITS.GEM
			},
			{
				caption: i18n.t("app:city.summary.eligibleItems"), value: formatNumber(data.enchantableItems.length)
			}
		]} />
		<ExpandableList>
			<Fact label={i18n.t("app:city.summary.enchantment")} value={`${AppIcons.getIcon(`enchantmentTypes.${data.enchantmentType}`)} ${i18n.t(`items:enchantments.${data.enchantmentId}`)}`} />
			<Fact label={i18n.t("app:city.summary.compatibleWith")} value={compatibleItemType} />
			<Fact label={i18n.t("app:city.summary.money")} value={`${formatMoney(data.playerMoney)} · ${data.playerGems} ${AppIcons.getIcon("unitValues.gem")}`} />
			{data.mageReduction ? <Fact label={i18n.t("app:city.summary.discount")} value={i18n.t("app:common.yes")} /> : null}
		</ExpandableList>
	</>;
}

function renderRoyalBlacksmithSummary(snapshot: CityMobileSnapshot): ReactNode {
	const data = snapshot.royalBlacksmith;
	if (!data) {
		return null;
	}
	return <>
		<Figures items={[
			{
				caption: i18n.t("app:city.summary.playerLevel"), value: `${formatNumber(data.playerLevel)} / ${formatNumber(data.requiredPlayerLevel)}`
			},
			{
				caption: i18n.t("app:city.summary.money"), value: formatNumber(data.playerMoney), unit: AMOUNT_UNITS.MONEY
			},
			{
				caption: i18n.t("app:city.summary.gems"), value: formatNumber(data.playerGems), unit: AMOUNT_UNITS.GEM
			}
		]} />
		<ExpandableList><Fact label={i18n.t("app:city.summary.status")} value={i18n.t(`app:city.status.${data.status}`)} /></ExpandableList>
	</>;
}

function renderGuildSummary(snapshot: CityMobileSnapshot): ReactNode {
	if (snapshot.guildDomain) {
		const guild = snapshot.guildDomain;
		return <>
			<Figures items={[
				{
					caption: i18n.t("app:city.summary.guildLevel"), value: formatNumber(guild.guildLevel)
				},
				{
					caption: i18n.t("app:city.summary.treasury"), value: formatNumber(guild.treasury), unit: AMOUNT_UNITS.MONEY
				},
				{
					caption: i18n.t("app:city.summary.money"), value: formatNumber(guild.playerMoney), unit: AMOUNT_UNITS.MONEY
				}
			]} />
			<ExpandableList>
				<Fact label={i18n.t("app:city.summary.guild")} value={guild.guildName} />
				<Fact label={i18n.t("app:city.summary.buildings")} value={i18n.t("app:city.summary.buildingLevels", {
					shop: guild.shopLevel,
					shelter: guild.shelterLevel,
					pantry: guild.pantryLevel,
					training: guild.trainingGroundLevel,
					recruitment: guild.recruitmentOfficeLevel
				})} />
				<Fact label={i18n.t("app:city.summary.foodStock")} value={i18n.t("app:city.summary.foodStockDetails", guild.food)} />
			</ExpandableList>
		</>;
	}
	const notary = snapshot.guildDomainNotary;
	return notary
		? <>
			<Figures items={[
				{
					caption: i18n.t("app:city.summary.domainCost"), value: formatNumber(notary.cost), unit: AMOUNT_UNITS.MONEY
				},
				{
					caption: i18n.t("app:city.summary.treasury"), value: formatNumber(notary.treasury), unit: AMOUNT_UNITS.MONEY
				}
			]} />
			<ExpandableList><Fact label={i18n.t("app:city.summary.domain")} value={notary.hasDomain ? i18n.t("app:common.yes") : i18n.t("app:common.no")} /></ExpandableList>
		</>
		: null;
}

const SUMMARY_RENDERERS: Partial<Record<CitySubmenu, SummaryRenderer>> = {
	inn: renderInnSummary,
	home: renderHomeSummary,
	homeBed: renderHomeBedSummary,
	homeGarden: renderHomeGardenSummary,
	homeUpgrade: renderHomeUpgradeSummary,
	notary: renderCityNotarySummary,
	enchanter: renderEnchanterSummary,
	royalBlacksmith: renderRoyalBlacksmithSummary,
	guild: renderGuildSummary
};

/** The figures heading a submenu, or null when it has none: the first section then opens the page. */
export function useCitySnapshotSummary(view: CitySubmenu, snapshot?: CityMobileSnapshot): ReactNode {
	const colors = useColors();
	return snapshot ? SUMMARY_RENDERERS[view]?.(snapshot, colors) ?? null : null;
}
