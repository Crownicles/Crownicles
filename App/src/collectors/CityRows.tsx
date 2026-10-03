import {ReactNode} from "react";
import {Text} from "react-native";
import type {CityEntry, CityInfoItem, CityListItem, CityMenuData, CityNavigationItem, CityReactionItem} from "@/src/collectors/CityCollector";
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
import {ActionBanner, ENTRY_CHEVRONS, ExpandableEntry, ExpandableList, Lock, LockHint, useSectionStyles} from "@/src/design/Sections";
import {ExpandedEntry, useExpandedEntry} from "@/src/design/useExpandedEntry";
import {useAfterDismissal} from "@/src/design/useAfterDismissal";
import {i18n} from "@/src/translations/i18n";

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

	/** What the unfolded row explains before the player confirms. */
	rowDetails?: (reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined) => ReactNode;
};

type ReactionRowState = {snapshot: CityMobileSnapshot | undefined; choosable: boolean; lock: Lock | undefined};

function entryCaption(subtitle: string | undefined, lock: Lock | undefined, expanded: boolean): ReactNode {
	if (lock && !expanded) return <LockHint lock={lock} />;
	return subtitle === undefined ? undefined : plainStory(subtitle);
}

function EntryEnd({value}: {value: string | undefined}): ReactNode {
	const sectionStyles = useSectionStyles();
	return value ? <Text style={sectionStyles.caption}>{plainStory(value)}</Text> : null;
}

/** A row that leads to a submenu, or only states a fact: neither unfolds. */
function staticEntry(item: CityNavigationItem | CityInfoItem, props: CityRowsProps): ReactNode {
	const navigation = item.kind === "navigation";
	return <ExpandableEntry
		key={item.key}
		emblem={props.iconForPath(item.iconPath)}
		label={item.title}
		caption={item.kind === "info" && item.lock ? <LockHint lock={item.lock} /> : item.subtitle}
		chevron={navigation ? ENTRY_CHEVRONS.FORWARD : ENTRY_CHEVRONS.NONE}
		{...navigation ? {dimmed: props.locked} : {dimmed: Boolean(item.lock)}}
		expanded={false}
		onToggle={(): void => {
			if (item.kind === "navigation" && !props.locked) props.onNavigate(item);
		}}
	/>;
}

function reactionRowState(reaction: ReactionCollectorReaction, {collector, reactionAvailable}: CityRowsProps): ReactionRowState {
	const snapshot = collector.data.type === CITY_DATA_KINDS.CITY ? collector.data.data.snapshot : undefined;
	const available = reactionAvailable(reaction, snapshot);
	return {
		snapshot,
		choosable: available && isChoosable(reaction, collector.data),
		lock: available ? undefined : cityReactionLock(reaction, snapshot)
	};
}

/** The one sheet a list unfolds at a time, and the choice it sends once put away. */
type CitySheet = {unfolding: ExpandedEntry<string>; confirmation: ReturnType<typeof useAfterDismissal>};

function reactionEntry(item: CityReactionItem, props: CityRowsProps, {unfolding, confirmation}: CitySheet): ReactNode {
	const {collector, locked, onChoose, rowIcon, rowTitle, rowSubtitle, rowEnd} = props;
	const {reaction, index} = item.entry;
	const key = JSON.stringify(reaction);
	const {snapshot, choosable, lock} = reactionRowState(reaction, props);
	const confirms = CITY_REACTIONS_REQUIRING_CONFIRMATION.has(reaction.type);
	const expanded = confirms && unfolding.isExpanded(key);
	const shared = {
		emblem: rowIcon(reaction, snapshot),
		label: plainStory(rowTitle(reaction, collector.data, snapshot)),
		caption: entryCaption(rowSubtitle(reaction, snapshot), lock, expanded),
		end: <EntryEnd value={rowEnd(reaction, snapshot)} />,
		dimmed: locked || !choosable
	};
	if (!confirms) {
		return <ExpandableEntry
			key={key}
			{...shared}
			chevron={ENTRY_CHEVRONS.FORWARD}
			expanded={false}
			onToggle={(): void => {
				if (!shared.dimmed) onChoose(index);
			}}
		/>;
	}
	return <ExpandableEntry
		key={key}
		{...shared}
		expanded={expanded}
		onToggle={(): void => unfolding.toggle(key)}
		onDismissed={confirmation.onDismissed}
	>
		{props.rowDetails?.(reaction, snapshot)}
		<ActionBanner
			icon={Check}
			label={i18n.t("app:collector.accept")}
			pending={locked}
			onPress={(): void => {
				confirmation.defer(() => onChoose(index));
				unfolding.collapse();
			}}
			{...lock ? {lock} : {}}
		/>
	</ExpandableEntry>;
}

function cityEntry(item: CityListItem, props: CityRowsProps, sheet: CitySheet): ReactNode {
	return item.kind === "reaction" ? reactionEntry(item, props, sheet) : staticEntry(item, props);
}

export function CityRows(props: CityRowsProps): ReactNode {
	const sheet = {unfolding: useExpandedEntry<string>(), confirmation: useAfterDismissal()};
	return <ExpandableList>{props.items.map(item => cityEntry(item, props, sheet))}</ExpandableList>;
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
