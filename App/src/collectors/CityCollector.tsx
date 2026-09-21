import {ReactNode, useState} from "react";
import {StyleSheet, View} from "react-native";
import {useRouter} from "expo-router";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {
	CITY_DATA_KINDS,
	GENERIC_REACTION_KINDS,
	CityMobileSnapshot,
	ReactionCollectorReaction
} from "ws-packets/src/fromServer/collectors";
import {AppIcons} from "@/src/AppIcons";
import {CitySubmenuView} from "@/src/collectors/CitySubmenuView";
import {
	cityRowEnd as renderCityRowEnd,
	cityRowSubtitle as renderCityRowSubtitle
} from "@/src/collectors/CityRowDetails";
import {
	cityReactionAvailable, cityRowIcon, cityRowTitle, iconForPath
} from "@/src/collectors/CityRowPresentation";
import {groupCityEntries} from "@/src/collectors/CityMenuModel";
import {CitySection} from "@/src/collectors/CityRows";
import {Note, Screen} from "@/src/design/Primitives";
import {Standing} from "@/src/design/Sections";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {i18n} from "@/src/translations/i18n";
import {HOME_SERVICE_DESTINATIONS} from "@/src/navigation/HomeServices";

type CityCollectorProps = {
	collector: ReactionCollectorCreation;
	onChoose: (reactionIndex: number) => void;
	submitting: boolean;
};

export type CityMenuData = Pick<ReactionCollectorCreation, "data" | "reactions">;
type CityMenuProps = Omit<CityCollectorProps, "collector"> & {collector: CityMenuData};

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
export type CityGroup = "housing" | "services" | "shops" | "guild" | "quit";
export type CityMenuModel = {groups: Record<CityGroup, CityListItem[]>; submenus: Record<CitySubmenu, CityEntry[]>};
export type CityGroupingOptions = {
	availableServices?: string[];
	innIds?: string[];
	homeOwned?: NonNullable<CityMobileSnapshot["home"]>["owned"];
	homeManage?: NonNullable<CityMobileSnapshot["home"]>["manage"];
	shops?: CityMobileSnapshot["shops"];
	guildFoodShop?: CityMobileSnapshot["guildFoodShop"];
};
export type CityGroupingState = {
	groups: Record<CityGroup, CityListItem[]>;
	submenus: Record<CitySubmenu, CityEntry[]>;
	inns: Map<string, CityEntry[]>;
	hasNotary: boolean;
	hasGuildActions: boolean;
};
export type CitySubmenuSection = {title: string; items: CityListItem[]};

const CITY_EMBLEM_SIZE = 34;

const cityStyles = StyleSheet.create({
	stack: {
		flex: 1
	}
});

function citySectionDefinitions(): {key: CityGroup; title: string; hint?: string}[] {
	return [
		{key: "housing", title: i18n.t("app:city.titles.housing")},
		{key: "services", title: i18n.t("app:city.titles.services")},
		{key: "shops", title: i18n.t("app:city.titles.shops")},
		{key: "guild", title: i18n.t("app:city.titles.guild")},
		{key: "quit", title: i18n.t("app:city.titles.quit")}
	];
}

function cityOverview({collector, model, locationName, locationDescription, mapIcon, choose, navigate, locked, submitting}: {
	collector: CityMenuData;
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
		<Standing {...mapIcon ? {emblem: mapIcon} : {}} caption={i18n.t("app:city.titles.eyebrow")} title={locationName} subtitle={locationDescription} />
		{sections.map((section, index) => <CitySection key={section.key} title={section.title} hint={section.hint} items={model.groups[section.key]} collector={collector} onChoose={choose} onNavigate={navigate} locked={locked} first={index === 0} iconForPath={iconForPath} rowIcon={cityRowIcon} rowTitle={cityRowTitle} rowSubtitle={renderCityRowSubtitle} rowEnd={renderCityRowEnd} reactionAvailable={cityReactionAvailable} />)}
		{submitting ? <Note>{i18n.t("app:collector.answering")}</Note> : null}
	</Screen>;
}

function cityServiceOptions(data: CityCollectorData): Pick<CityGroupingOptions, "availableServices" | "innIds" | "shops" | "guildFoodShop"> {
	const snapshot = data.data.snapshot;
	return {
		availableServices: data.data.availableServices,
		innIds: snapshot?.inns?.map(inn => inn.innId),
		shops: snapshot?.shops,
		guildFoodShop: snapshot?.guildFoodShop
	};
}

function cityHomeOptions(snapshot: CityMobileSnapshot | undefined): Pick<CityGroupingOptions, "homeOwned" | "homeManage"> {
	return {homeOwned: snapshot?.home?.owned, homeManage: snapshot?.home?.manage};
}

function cityGroupingOptions(data: CityCollectorData): Parameters<typeof groupCityEntries>[1] {
	return {...cityServiceOptions(data), ...cityHomeOptions(data.data.snapshot)};
}

function renderGardenView({collector, model, snapshot, choose, gardenCloseIndex, locked}: {
	collector: CityMenuData;
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
	collector: CityMenuData;
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
		overlay
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
	collector: CityMenuData;
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
	/** The city list keeps its place in the tree so an opening submenu never remounts it. */
	return <View style={cityStyles.stack}>
		{cityOverview({collector, model, locationName, locationDescription, mapIcon, choose, navigate, locked, submitting})}
		{submenu ? renderSubmenuView({submenu, innId, model, collector, snapshot, choose, navigate, setSubmenu, locked}) : null}
	</View>;
}

type CityNavigation = {
	submenu: CitySubmenu | null;
	setSubmenu: (submenu: CitySubmenu | null) => void;
	innId: string | undefined;
	navigate: (item: CityNavigationItem) => void;
};

function useCityNavigation(): CityNavigation {
	const router = useRouter();
	const [submenu, setSubmenu] = useState<CitySubmenu | null>(null);
	const [innId, setInnId] = useState<string>();
	const navigate = (item: CityNavigationItem): void => {
		if (item.view in HOME_SERVICE_DESTINATIONS) {
			const service = HOME_SERVICE_DESTINATIONS[item.view as keyof typeof HOME_SERVICE_DESTINATIONS];
			router.push({pathname: "/home/[service]", params: {service}});
			return;
		}
		setInnId(item.innId);
		setSubmenu(item.view);
	};
	return {submenu, setSubmenu, innId, navigate};
}

export function CityMenu({collector, onChoose, submitting}: CityMenuProps): ReactNode {
	const {
		submenu, setSubmenu, innId, navigate
	} = useCityNavigation();
	const locked = submitting;
	const entries = collector.reactions.map((reaction, index) => ({reaction, index}));
	const choose = (index: number): void => {
		if (!locked) onChoose(index);
	};
	if (collector.data.type !== CITY_DATA_KINDS.CITY) return null;
	const data = collector.data;
	const snapshot = data.data.snapshot;
	const model = groupCityEntries(entries, cityGroupingOptions(data));
	const locationName = i18n.t(`models:map_locations.${data.data.mapLocationId}.name`);
	const locationDescription = i18n.t(`models:map_locations.${data.data.mapLocationId}.description`);
	const mapEmoji = AppIcons.getIconOrNull(`mapTypes.${data.data.mapTypeId}`);
	const mapIcon = mapEmoji ? <TwemojiIcon emoji={mapEmoji} size={CITY_EMBLEM_SIZE} /> : undefined;
	const gardenOnly = data.data.gardenOnly === true;
	const gardenCloseIndex = gardenOnly ? collector.reactions.findIndex(reaction => reaction.type === GENERIC_REACTION_KINDS.REFUSE) : -1;
	return cityCollectorView({collector, model, snapshot, gardenOnly, gardenCloseIndex, submenu, innId, choose, navigate, setSubmenu, locked, locationName, locationDescription, mapIcon, submitting});
}

export function CityCollector({collector, onChoose, submitting}: CityCollectorProps): ReactNode {
	const [answered, setAnswered] = useState(false);
	const choose = (index: number): void => {
		if (answered || submitting) return;
		setAnswered(true);
		onChoose(index);
	};
	return <CityMenu collector={collector} onChoose={choose} submitting={answered || submitting} />;
}
