import {ReactNode, useState} from "react";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {
	CITY_DATA_KINDS,
	GENERIC_REACTION_KINDS,
	CityMobileSnapshot,
	ReactionCollectorReaction
} from "ws-packets/src/fromServer/collectors";
import {AppIcons} from "@/src/AppIcons";
import {CitySnapshotSummary} from "@/src/collectors/CitySnapshotSummary";
import {citySnapshotNote} from "@/src/collectors/CitySnapshotNote";
import {gardenPlotItems, homeChestItems, homeCookingItems, homeFeatureItems, homeIconPath} from "@/src/collectors/CityHomeItems";
import {enchantmentCatalogItems, guildFeatureItems} from "@/src/collectors/CityGuildItems";
import {
	cityRowEnd as renderCityRowEnd,
	cityRowSubtitle as renderCityRowSubtitle
} from "@/src/collectors/CityRowDetails";
import {cityReactionAvailable, cityRowIcon, cityRowTitle, iconForPath} from "@/src/collectors/CityRowPresentation";
import {groupCityEntries, cityNavigationMeta, submenuTitle} from "@/src/collectors/CityMenuModel";
import {CitySection} from "@/src/collectors/CityRows";
import {submenuSections as buildSubmenuSections} from "@/src/collectors/CitySubmenuSections";
import {Button, ButtonRow, Hero, Note, Screen} from "@/src/design/Primitives";
import {i18n} from "@/src/translations/i18n";

type CityCollectorProps = {
	collector: ReactionCollectorCreation;
	onChoose: (reactionIndex: number) => void;
	submitting: boolean;
};

type CityCollectorData = Extract<ReactionCollectorCreation["data"], {type: typeof CITY_DATA_KINDS.CITY}>;

export type CityEntry = {reaction: ReactionCollectorReaction; index: number};
export type CitySubmenu = "home" | "homeBed" | "homeChest" | "homeGarden" | "homeCooking" | "homeUpgrade" | "notary" | "inn" | "enchanter" | "blacksmith" | "scrapDealer" | "royalBlacksmith" | "guild";

export type CityNavigationItem = {
	kind: "navigation";
	key: string;
	view: CitySubmenu;
	innId?: string;
	iconPath: string;
	title: string;
	subtitle?: string;
};

export type CityInfoItem = {
	kind: "info";
	key: string;
	iconPath: string;
	title: string;
	subtitle: string;
};

type CityReactionItem = {kind: "reaction"; entry: CityEntry};
export type CityListItem = CityNavigationItem | CityInfoItem | CityReactionItem;
export type CityGroup = "housing" | "services" | "shops" | "guild" | "elsewhere" | "quit";
export type CityMenuModel = {groups: Record<CityGroup, CityListItem[]>; submenus: Record<CitySubmenu, CityEntry[]>};
export type CityGroupingOptions = {
	availableServices?: string[];
	innIds?: string[];
	homeOwned?: NonNullable<CityMobileSnapshot["home"]>["owned"];
	homeManage?: NonNullable<CityMobileSnapshot["home"]>["manage"];
	shops?: CityMobileSnapshot["shops"];
	guildFoodShop?: CityMobileSnapshot["guildFoodShop"];
	otherCityServices?: CityMobileSnapshot["otherCityServices"];
};
export type CityGroupingState = {
	groups: Record<CityGroup, CityListItem[]>;
	submenus: Record<CitySubmenu, CityEntry[]>;
	inns: Map<string, CityEntry[]>;
	hasNotary: boolean;
	hasGuildActions: boolean;
};
export type CitySubmenuSection = {title: string; items: CityListItem[]};

function CitySubmenuView({view, innId, entries, collector, snapshot, onChoose, onNavigate, onBack, locked, backLabel}: {
	view: CitySubmenu;
	innId?: string;
	entries: CityEntry[];
	collector: ReactionCollectorCreation;
	snapshot?: CityMobileSnapshot;
	onChoose: (reactionIndex: number) => void;
	onNavigate: (item: CityNavigationItem) => void;
	onBack: () => void;
	locked: boolean;
	backLabel?: string;
}): ReactNode {
	const details = submenuTitle(view, innId);
	const iconPath = view === "inn" ? "city.inn" : view === "home" ? homeIconPath(snapshot?.home?.owned?.level) : cityNavigationMeta(view as Exclude<CitySubmenu, "inn">).iconPath;
	const icon = AppIcons.getIconOrNull(iconPath);
	const sections = buildSubmenuSections(view, entries, snapshot, {homeFeatureItems, gardenPlotItems, homeChestItems, homeCookingItems, guildFeatureItems, enchantmentCatalogItems});
	const visibleSections = sections.filter(section => section.items.length > 0);

	return (
		<Screen>
			<Hero eyebrow={details.eyebrow} title={`${icon ? `${icon} ` : ""}${details.title}`} subtitle={details.subtitle} />
			<CitySnapshotSummary view={view} snapshot={snapshot} />
			{visibleSections.map((section, index) => (
				<CitySection
					key={section.title}
					title={section.title}
					items={section.items}
					collector={collector}
					onChoose={onChoose}
					onNavigate={onNavigate}
					locked={locked}
					first={index === 0}
					iconForPath={iconForPath}
					rowIcon={cityRowIcon}
					rowTitle={cityRowTitle}
					rowSubtitle={renderCityRowSubtitle}
					rowEnd={renderCityRowEnd}
					reactionAvailable={cityReactionAvailable}
				/>
			))}
			{citySnapshotNote(view, snapshot)}
			{visibleSections.length === 0 ? <Note>{i18n.t("app:city.subtitles.noActions")}</Note> : null}
			<ButtonRow><Button disabled={locked} onPress={locked ? undefined : onBack}>{backLabel ?? i18n.t("app:city.actions.back")}</Button></ButtonRow>
		</Screen>
	);
}

function citySectionDefinitions(): {key: CityGroup; title: string; hint?: string}[] {
	return [
		{key: "housing", title: i18n.t("app:city.titles.housing")},
		{key: "services", title: i18n.t("app:city.titles.services")},
		{key: "shops", title: i18n.t("app:city.titles.shops")},
		{key: "guild", title: i18n.t("app:city.titles.guild")},
		{key: "elsewhere", title: i18n.t("app:city.titles.otherCities"), hint: i18n.t("app:city.subtitles.otherCities")},
		{key: "quit", title: i18n.t("app:city.titles.quit")}
	];
}

function cityOverview({collector, model, locationName, locationDescription, mapIcon, choose, navigate, locked, submitting}: {
	collector: ReactionCollectorCreation;
	model: CityMenuModel;
	locationName: string;
	locationDescription: string;
	mapIcon: ReactNode | undefined;
	choose: (index: number) => void;
	navigate: (item: CityNavigationItem) => void;
	locked: boolean;
	submitting: boolean;
}): ReactNode {
	const sections = citySectionDefinitions().filter(section => model.groups[section.key].length > 0);
	return <Screen>
		<Hero eyebrow={i18n.t("app:city.titles.eyebrow")} title={`${mapIcon ? `${mapIcon} ` : ""}${locationName}`} subtitle={locationDescription} />
		{sections.map((section, index) => <CitySection key={section.key} title={section.title} hint={section.hint} items={model.groups[section.key]} collector={collector} onChoose={choose} onNavigate={navigate} locked={locked} first={index === 0} iconForPath={iconForPath} rowIcon={cityRowIcon} rowTitle={cityRowTitle} rowSubtitle={renderCityRowSubtitle} rowEnd={renderCityRowEnd} reactionAvailable={cityReactionAvailable} />)}
		{submitting ? <Note>{i18n.t("app:collector.answering")}</Note> : null}
	</Screen>;
}

function cityGroupingOptions(data: CityCollectorData): Parameters<typeof groupCityEntries>[1] {
	const snapshot = data.data.snapshot;
	return {
		availableServices: data.data.availableServices,
		innIds: snapshot?.inns?.map(inn => inn.innId),
		homeOwned: snapshot?.home?.owned,
		homeManage: snapshot?.home?.manage,
		shops: snapshot?.shops,
		guildFoodShop: snapshot?.guildFoodShop,
		otherCityServices: snapshot?.otherCityServices
	};
}

function renderGardenView({collector, model, snapshot, choose, gardenCloseIndex, locked}: {
	collector: ReactionCollectorCreation;
	model: CityMenuModel;
	snapshot: CityMobileSnapshot | undefined;
	choose: (index: number) => void;
	gardenCloseIndex: number;
	locked: boolean;
}): ReactNode {
	return <CitySubmenuView
		view="homeGarden"
		entries={model.submenus.homeGarden}
		collector={collector}
		snapshot={snapshot}
		onChoose={choose}
		onNavigate={() => undefined}
		onBack={() => { if (gardenCloseIndex >= 0) choose(gardenCloseIndex); }}
		backLabel={i18n.t("app:city.actions.close")}
		locked={locked}
	/>;
}

function renderSubmenuView({submenu, innId, model, collector, snapshot, choose, navigate, setSubmenu, locked}: {
	submenu: CitySubmenu;
	innId: string | undefined;
	model: CityMenuModel;
	collector: ReactionCollectorCreation;
	snapshot: CityMobileSnapshot | undefined;
	choose: (index: number) => void;
	navigate: (item: CityNavigationItem) => void;
	setSubmenu: (submenu: CitySubmenu | null) => void;
	locked: boolean;
}): ReactNode {
	const submenuEntries = submenu === "inn" && innId
		? model.submenus.inn.filter(entry => (entry.reaction.data as {innId: string}).innId === innId)
		: model.submenus[submenu];
	return <CitySubmenuView
		view={submenu}
		innId={innId}
		entries={submenuEntries}
		collector={collector}
		snapshot={snapshot}
		onChoose={choose}
		onNavigate={navigate}
		onBack={() => setSubmenu(null)}
		locked={locked}
	/>;
}

function cityCollectorView({collector, model, snapshot, gardenOnly, gardenCloseIndex, submenu, innId, choose, navigate, setSubmenu, locked, locationName, locationDescription, mapIcon, submitting}: {
	collector: ReactionCollectorCreation;
	model: CityMenuModel;
	snapshot: CityMobileSnapshot | undefined;
	gardenOnly: boolean;
	gardenCloseIndex: number;
	submenu: CitySubmenu | null;
	innId: string | undefined;
	choose: (index: number) => void;
	navigate: (item: CityNavigationItem) => void;
	setSubmenu: (submenu: CitySubmenu | null) => void;
	locked: boolean;
	locationName: string;
	locationDescription: string;
	mapIcon: ReactNode | undefined;
	submitting: boolean;
}): ReactNode {
	if (gardenOnly) return renderGardenView({collector, model, snapshot, choose, gardenCloseIndex, locked});
	if (submenu) return renderSubmenuView({submenu, innId, model, collector, snapshot, choose, navigate, setSubmenu, locked});
	return cityOverview({collector, model, locationName, locationDescription, mapIcon, choose, navigate, locked, submitting});
}

export function CityCollector({collector, onChoose, submitting}: CityCollectorProps): ReactNode {
	const [answered, setAnswered] = useState(false);
	const [submenu, setSubmenu] = useState<CitySubmenu | null>(null);
	const [innId, setInnId] = useState<string>();
	if (collector.data.type !== CITY_DATA_KINDS.CITY) return null;
	const locked = answered || submitting;
	const entries = collector.reactions.map((reaction, index) => ({reaction, index}));
	const data = collector.data;
	const snapshot = data.data.snapshot;
	const model = groupCityEntries(entries, cityGroupingOptions(data));
	const locationName = i18n.t(`models:map_locations.${data.data.mapLocationId}.name`);
	const locationDescription = i18n.t(`models:map_locations.${data.data.mapLocationId}.description`);
	const mapIcon = AppIcons.getIconOrNull(`mapTypes.${data.data.mapTypeId}`);
	const choose = (index: number): void => {
		if (locked) return;
		setAnswered(true);
		onChoose(index);
	};
	const navigate = (item: CityNavigationItem): void => {
		setInnId(item.innId);
		setSubmenu(item.view);
	};
	const gardenOnly = data.data.gardenOnly === true;
	const gardenCloseIndex = gardenOnly ? collector.reactions.findIndex(reaction => reaction.type === GENERIC_REACTION_KINDS.REFUSE) : -1;
	return cityCollectorView({collector, model, snapshot, gardenOnly, gardenCloseIndex, submenu, innId, choose, navigate, setSubmenu, locked, locationName, locationDescription, mapIcon, submitting});
}
