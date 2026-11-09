import { ReactNode } from "react";
import { Text } from "react-native";
import type {
	CityInfoItem, CityListItem, CityMenuData, CityNavigationItem, CityReactionItem
} from "@/src/collectors/CityCollector";
import {
	CITY_DATA_KINDS,
	CITY_REACTION_KINDS,
	CityMobileSnapshot,
	ReactionCollectorReaction
} from "ws-packets/src/fromServer/collectors";
import { isChoosable } from "@/src/collectors/CollectorLabels";
import { cityReactionLock } from "@/src/collectors/CityReactionLocks";
import { plainStory } from "@/src/display/Markdown";
import { SectionHeader } from "@/src/design/Primitives";
import {
	Check, LucideIcon
} from "@/src/design/FightIcons";
import {
	ActionBanner, ENTRY_CHEVRONS, ExpandableEntry, ExpandableList, Lock, LockHint, useSectionStyles
} from "@/src/design/Sections";
import {
	ExpandedEntry, useExpandedEntry
} from "@/src/design/useExpandedEntry";
import { useAfterDismissal } from "@/src/design/useAfterDismissal";
import { useCurrentTime } from "@/src/store/useCurrentTime";
import { i18n } from "@/src/translations/i18n";

/** Inn cooldowns are worded in minutes: reading the time this often lifts them close enough to their end. */
const COOLDOWN_CLOCK_MS = 10_000;

/** Actions that spend something, and therefore ask for a second tap inside the unfolded row. */
const CITY_REACTIONS_REQUIRING_CONFIRMATION = new Set<ReactionCollectorReaction["type"]>([
	CITY_REACTION_KINDS.BUY_HOME,
	CITY_REACTION_KINDS.UPGRADE_HOME,
	CITY_REACTION_KINDS.MOVE_HOME,
	CITY_REACTION_KINDS.APARTMENT_BUY,
	CITY_REACTION_KINDS.INN_MEAL,
	CITY_REACTION_KINDS.INN_ROOM,
	CITY_REACTION_KINDS.ENCHANT,
	CITY_REACTION_KINDS.ENCHANTER_DISENCHANT,
	CITY_REACTION_KINDS.UPGRADE_ITEM,
	CITY_REACTION_KINDS.BLACKSMITH_UPGRADE,
	CITY_REACTION_KINDS.BLACKSMITH_ENCHANTMENT_TRANSFER,
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
	reactionAvailable: (reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined, now: number) => boolean;

	/** What the unfolded row explains before the player confirms. */
	rowDetails?: (reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined) => ReactNode;

	/** The confirm button worded after the action, instead of a plain confirmation. */
	rowConfirm?: (reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined) => RowConfirm | undefined;

	/** Rows kept at full contrast while locked, their sheet saying why, when the lock is not what matters. */
	staysBright?: (reaction: ReactionCollectorReaction) => boolean;
};

export type RowConfirm = {
	label: string;
	icon: LucideIcon;

	/** What the player should know before pressing, such as an action that cannot be undone. */
	hint?: Lock;
};

type ReactionRowState = {
	snapshot: CityMobileSnapshot | undefined; choosable: boolean; lock: Lock | undefined;
};

function entryCaption(subtitle: string | undefined, lock: Lock | undefined, expanded: boolean): ReactNode {
	if (lock && !expanded) {
		return <LockHint lock={lock} />;
	}
	return subtitle === undefined ? undefined : plainStory(subtitle);
}

function EntryEnd({ value }: { value: string | undefined }): ReactNode {
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
		{...navigation ? { dimmed: props.locked } : { dimmed: Boolean(item.lock) }}
		expanded={false}
		onToggle={(): void => {
			if (item.kind === "navigation" && !props.locked) {
				props.onNavigate(item);
			}
		}}
	/>;
}

function reactionRowState(reaction: ReactionCollectorReaction, {
	collector, reactionAvailable
}: CityRowsProps, now: number): ReactionRowState {
	const snapshot = collector.data.type === CITY_DATA_KINDS.CITY ? collector.data.data.snapshot : undefined;
	const available = reactionAvailable(reaction, snapshot, now);
	return {
		snapshot,
		choosable: available && isChoosable(reaction, collector.data),
		lock: available ? undefined : cityReactionLock(reaction, snapshot, now)
	};
}

/** The one sheet a list unfolds at a time, the choice it sends once put away, and the time the cooldowns are read at. */
type CitySheet = {
	unfolding: ExpandedEntry<string>; confirmation: ReturnType<typeof useAfterDismissal>; now: number;
};

/** A reaction row as the list shows it, whether it is sent at once or unfolds first. */
type ReactionEntryLook = {
	emblem: ReactNode; label: string; caption: ReactNode; end: ReactNode; dimmed: boolean;
};

/** How a reaction row reads: the lock its caption tells, whether it is unfolded and whether it is switched off. */
type ReactionRowLook = {
	snapshot: CityMobileSnapshot | undefined; lock: Lock | undefined; expanded: boolean; dimmed: boolean;
};

function reactionEntryLook(reaction: ReactionCollectorReaction, props: CityRowsProps, {
	snapshot, lock, expanded, dimmed
}: ReactionRowLook): ReactionEntryLook {
	return {
		emblem: props.rowIcon(reaction, snapshot),
		label: plainStory(props.rowTitle(reaction, props.collector.data, snapshot)),
		caption: entryCaption(props.rowSubtitle(reaction, snapshot), lock, expanded),
		end: <EntryEnd value={props.rowEnd(reaction, snapshot)} />,
		dimmed
	};
}

/** A reaction sent at the first tap, unless its row is switched off. */
function directReactionEntry(item: CityReactionItem, props: CityRowsProps, now: number): ReactNode {
	const {
		reaction, index
	} = item.entry;
	const {
		snapshot, choosable, lock
	} = reactionRowState(reaction, props, now);
	const look = reactionEntryLook(reaction, props, {
		snapshot, lock, expanded: false, dimmed: props.locked || !choosable
	});
	return <ExpandableEntry
		key={JSON.stringify(reaction)}
		{...look}
		chevron={ENTRY_CHEVRONS.FORWARD}
		expanded={false}
		onToggle={(): void => {
			if (!look.dimmed) {
				props.onChoose(index);
			}
		}}
	/>;
}

/** The button of an unfolded row, worded after its action when the menu says how. */
function confirmationBanner(confirm: RowConfirm | undefined, {
	pending, lock, onPress
}: {
	pending: boolean; lock: Lock | undefined; onPress: () => void;
}): ReactNode {
	return <ActionBanner
		icon={confirm?.icon ?? Check}
		label={confirm?.label ?? i18n.t("app:collector.accept")}
		pending={pending}
		onPress={onPress}
		{...lock ? { lock } : {}}
		{...confirm?.hint ? { hint: confirm.hint } : {}}
	/>;
}

/** A reaction that spends something: its row unfolds on what it does, and a second tap confirms it. */
function confirmedReactionEntry(item: CityReactionItem, props: CityRowsProps, {
	unfolding, confirmation, now
}: CitySheet): ReactNode {
	const {
		reaction, index
	} = item.entry;
	const key = JSON.stringify(reaction);
	const {
		snapshot, choosable, lock
	} = reactionRowState(reaction, props, now);
	const bright = props.staysBright?.(reaction) ?? false;
	const expanded = unfolding.isExpanded(key);
	const look = reactionEntryLook(reaction, props, {
		snapshot,
		lock: bright ? undefined : lock,
		expanded,
		dimmed: props.locked || !choosable && !bright
	});
	return <ExpandableEntry
		key={key}
		{...look}
		expanded={expanded}
		onToggle={(): void => unfolding.toggle(key)}
		onDismissed={confirmation.onDismissed}
	>
		{props.rowDetails?.(reaction, snapshot)}
		{confirmationBanner(props.rowConfirm?.(reaction, snapshot), {
			pending: props.locked,
			lock,
			onPress: (): void => {
				confirmation.defer(() => props.onChoose(index));
				unfolding.collapse();
			}
		})}
	</ExpandableEntry>;
}

function reactionEntry(item: CityReactionItem, props: CityRowsProps, sheet: CitySheet): ReactNode {
	return CITY_REACTIONS_REQUIRING_CONFIRMATION.has(item.entry.reaction.type)
		? confirmedReactionEntry(item, props, sheet)
		: directReactionEntry(item, props, sheet.now);
}

/** A fact worth telling at length: written at full contrast, it unfolds on what it means instead of looking switched off. */
function storyEntry(item: CityInfoItem, props: CityRowsProps, { unfolding }: CitySheet): ReactNode {
	return <ExpandableEntry
		key={item.key}
		emblem={props.iconForPath(item.iconPath)}
		label={item.title}
		caption={item.lock ? <LockHint lock={item.lock} /> : item.subtitle}
		expanded={unfolding.isExpanded(item.key)}
		onToggle={(): void => unfolding.toggle(item.key)}
	>{item.details}</ExpandableEntry>;
}

function cityEntry(item: CityListItem, props: CityRowsProps, sheet: CitySheet): ReactNode {
	if (item.kind === "reaction") {
		return reactionEntry(item, props, sheet);
	}
	return item.kind === "info" && item.details ? storyEntry(item, props, sheet) : staticEntry(item, props);
}

export function CityRows(props: CityRowsProps): ReactNode {
	const sheet = {
		unfolding: useExpandedEntry<string>(), confirmation: useAfterDismissal(), now: useCurrentTime(COOLDOWN_CLOCK_MS)
	};
	return <ExpandableList>{props.items.map(item => cityEntry(item, props, sheet))}</ExpandableList>;
}

export function CitySection({
	title, hint, items, first = false, ...rowProps
}: CityRowsProps & {
	title: string; hint?: string; first?: boolean;
}): ReactNode {
	if (items.length === 0) {
		return null;
	}
	return <>
		<SectionHeader first={first} action={hint ? { hint } : undefined}>{title}</SectionHeader>
		<CityRows items={items} {...rowProps} />
	</>;
}
