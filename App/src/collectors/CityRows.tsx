import {ReactNode, useState} from "react";
import {Text} from "react-native";
import type {CityMenuData} from "@/src/collectors/CityCollector";
import {
	CITY_DATA_KINDS,
	CITY_REACTION_KINDS,
	CityMobileSnapshot,
	ReactionCollectorReaction
} from "ws-packets/src/fromServer/collectors";
import {isChoosable} from "@/src/collectors/CollectorLabels";
import {cityReactionLock} from "@/src/collectors/CityReactionLocks";
import {plainStory} from "@/src/display/Markdown";
import {SectionHeader} from "@/src/design/Primitives";
import {Check} from "@/src/design/FightIcons";
import {
	ActionBanner, ENTRY_CHEVRONS, ExpandableEntry, ExpandableList, Lock, LockHint, sectionStyles
} from "@/src/design/Sections";
import {i18n} from "@/src/translations/i18n";

type CityEntry = {reaction: ReactionCollectorReaction; index: number};
type CitySubmenu = "home" | "homeBed" | "homeChest" | "homeGarden" | "homeCooking" | "homeUpgrade" | "notary" | "inn" | "enchanter" | "blacksmith" | "scrapDealer" | "royalBlacksmith" | "guild";
type CityNavigationItem = {kind: "navigation"; key: string; view: CitySubmenu; innId?: string; iconPath: string; title: string; subtitle?: string};
type CityInfoItem = {kind: "info"; key: string; iconPath: string; title: string; subtitle: string};
type CityReactionItem = {kind: "reaction"; entry: CityEntry};
type CityListItem = CityNavigationItem | CityInfoItem | CityReactionItem;

/** Actions that spend something, and therefore ask for a second tap inside the unfolded row. */
const CITY_REACTIONS_REQUIRING_CONFIRMATION = new Set<ReactionCollectorReaction["type"]>([
	CITY_REACTION_KINDS.BUY_HOME,
	CITY_REACTION_KINDS.UPGRADE_HOME,
	CITY_REACTION_KINDS.MOVE_HOME,
	CITY_REACTION_KINDS.APARTMENT_BUY,
	CITY_REACTION_KINDS.INN_MEAL,
	CITY_REACTION_KINDS.INN_ROOM,
	CITY_REACTION_KINDS.ENCHANT,
	CITY_REACTION_KINDS.UPGRADE_ITEM,
	CITY_REACTION_KINDS.BLACKSMITH_UPGRADE,
	CITY_REACTION_KINDS.BLACKSMITH_DISENCHANT,
	CITY_REACTION_KINDS.SCRAP_DEALER_RECYCLE,
	CITY_REACTION_KINDS.ROYAL_BLACKSMITH_UPGRADE,
	CITY_REACTION_KINDS.GARDEN_COMPOST
]);

type CityRowsProps = {
	items: CityListItem[];
	collector: CityMenuData;
	onChoose: (reactionIndex: number) => void;
	onNavigate: (item: CityNavigationItem) => void;
	locked: boolean;
	iconForPath: (iconPath: string) => ReactNode | undefined;
	rowIcon: (reaction: ReactionCollectorReaction, snapshot?: CityMobileSnapshot) => ReactNode | undefined;
	rowTitle: (reaction: ReactionCollectorReaction, collectorData: CityMenuData["data"], snapshot?: CityMobileSnapshot) => string;
	rowSubtitle: (reaction: ReactionCollectorReaction, snapshot?: CityMobileSnapshot) => string | undefined;
	rowEnd: (reaction: ReactionCollectorReaction, snapshot?: CityMobileSnapshot) => string | undefined;
	reactionAvailable: (reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined) => boolean;
};

type ExpansionProps = {openKey: string | undefined; onOpen: (key: string | undefined) => void};

function entryCaption(subtitle: string | undefined, lock: Lock | undefined, expanded: boolean): ReactNode {
	if (lock && !expanded) return <LockHint lock={lock} />;
	return subtitle === undefined ? undefined : plainStory(subtitle);
}

function entryEnd(value: string | undefined): ReactNode {
	return value ? <Text style={sectionStyles.caption}>{plainStory(value)}</Text> : null;
}

function navigationEntry(item: CityNavigationItem, props: CityRowsProps): ReactNode {
	return <ExpandableEntry
		key={item.key}
		emblem={props.iconForPath(item.iconPath)}
		label={item.title}
		caption={item.subtitle}
		chevron={ENTRY_CHEVRONS.FORWARD}
		dimmed={props.locked}
		expanded={false}
		onToggle={(): void => {
			if (!props.locked) props.onNavigate(item);
		}}
	/>;
}

function infoEntry(item: CityInfoItem, props: CityRowsProps): ReactNode {
	return <ExpandableEntry
		key={item.key}
		emblem={props.iconForPath(item.iconPath)}
		label={item.title}
		caption={item.subtitle}
		chevron={ENTRY_CHEVRONS.NONE}
		expanded={false}
		onToggle={(): void => undefined}
	/>;
}

function reactionEntry(item: CityReactionItem, props: CityRowsProps, expansion: ExpansionProps): ReactNode {
	const {collector, locked, onChoose, rowIcon, rowTitle, rowSubtitle, rowEnd, reactionAvailable} = props;
	const {reaction, index} = item.entry;
	const key = JSON.stringify(reaction);
	const snapshot = collector.data.type === CITY_DATA_KINDS.CITY ? collector.data.data.snapshot : undefined;
	const available = reactionAvailable(reaction, snapshot);
	const choosable = isChoosable(reaction, collector.data) && available;
	const lock = available ? undefined : cityReactionLock(reaction, snapshot);
	const confirms = CITY_REACTIONS_REQUIRING_CONFIRMATION.has(reaction.type);
	const expanded = confirms && expansion.openKey === key;
	const shared = {
		emblem: rowIcon(reaction, snapshot),
		label: plainStory(rowTitle(reaction, collector.data, snapshot)),
		caption: entryCaption(rowSubtitle(reaction, snapshot), lock, expanded),
		end: entryEnd(rowEnd(reaction, snapshot)),
		dimmed: locked || !choosable
	};
	if (!confirms) {
		return <ExpandableEntry
			key={key}
			{...shared}
			chevron={ENTRY_CHEVRONS.FORWARD}
			expanded={false}
			onToggle={(): void => {
				if (choosable && !locked) onChoose(index);
			}}
		/>;
	}
	return <ExpandableEntry
		key={key}
		{...shared}
		expanded={expanded}
		onToggle={(): void => expansion.onOpen(expanded ? undefined : key)}
	>
		<ActionBanner
			icon={Check}
			label={i18n.t("app:collector.accept")}
			pending={locked}
			onPress={(): void => onChoose(index)}
			{...lock ? {lock} : {}}
		/>
	</ExpandableEntry>;
}

function cityEntry(item: CityListItem, props: CityRowsProps, expansion: ExpansionProps): ReactNode {
	if (item.kind === "navigation") return navigationEntry(item, props);
	if (item.kind === "info") return infoEntry(item, props);
	return reactionEntry(item, props, expansion);
}

export function CityRows(props: CityRowsProps): ReactNode {
	const [openKey, onOpen] = useState<string>();
	return <ExpandableList>{props.items.map(item => cityEntry(item, props, {openKey, onOpen}))}</ExpandableList>;
}

export function CitySection({title, hint, items, first = false, ...rowProps}: CityRowsProps & {title: string; hint?: string; first?: boolean}): ReactNode {
	if (items.length === 0) {
		return null;
	}
	return <>
		<SectionHeader first={first} action={hint ? {hint} : undefined}>{title}</SectionHeader>
		<CityRows items={items} {...rowProps} />
	</>;
}
