import {ReactNode, useState} from "react";
import {Text} from "react-native";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {EQUIP_DATA_KINDS, EQUIP_REACTION_KINDS} from "ws-packets/src/fromServer/collectors";
import {EQUIP_ACTIONS, EquipCategoryData} from "ws-packets/src/objects/EquipCategoryData";
import {ItemWithDetails} from "ws-packets/src/objects/ItemWithDetails";
import {MainItem} from "ws-packets/src/objects/MainItem";
import {MainItemStat} from "ws-packets/src/objects/MainItemStat";
import {EquipActionReq} from "ws-packets/src/fromClient/EquipActionReq";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {useEquipmentActions} from "@/src/store/useEquipmentActions";
import {EmptyState, Note, SectionHeader} from "@/src/design/Primitives";
import {SegmentedControl} from "@/src/design/SegmentedControl";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {
	ActionBanner, ExpandableEntry, ExpandableList, Fact, Figure, Figures, sectionStyles, Sheet
} from "@/src/design/Sections";
import {ArrowRight, Check} from "@/src/design/FightIcons";
import {AppIcons} from "@/src/AppIcons";
import {itemDisplayName, itemIconPath, itemCategoryLabel} from "@/src/collectors/CollectorLabels";
import {consumableDescription} from "@/src/display/ItemEffects";
import {i18n} from "@/src/translations/i18n";

type EquipCollectorPacket = ReactionCollectorCreation & {data: Extract<ReactionCollectorCreation["data"], {type: typeof EQUIP_DATA_KINDS.COLLECTOR}>};
type EquipmentSelection = {request: EquipActionReq; item: ItemWithDetails};

/** The three numbers a weapon or an armour is judged on, in the order the rest of the game shows them. */
const MAIN_STATS = ["attack", "defense", "speed"] as const;

function statValue(stat: MainItemStat): number {
	return Math.min(stat.baseValue + stat.upgradeValue, stat.maxValue);
}

function isMainItem(item: ItemWithDetails): item is MainItem {
	return !("nature" in item);
}

function itemEmblem(item: ItemWithDetails): ReactNode {
	const path = itemIconPath(item);
	const icon = path ? AppIcons.getIconOrNull(path) : null;
	return icon ? <TwemojiIcon emoji={icon} size={Theme.dimensions.headerIcon} /> : undefined;
}

/** What is being worn right now, as the headline numbers of the category. */
function equippedFigures(item: ItemWithDetails): Figure[] {
	if (isMainItem(item)) {
		return MAIN_STATS.map(stat => ({
			caption: i18n.t(`app:equipment.stats.${stat}`),
			value: String(statValue(item[stat])),
			unit: stat
		}));
	}
	return [{caption: i18n.t("app:equipment.stats.effect"), value: consumableDescription(item)}];
}

/** Signed, so the row reads as a change rather than as a second set of numbers to compare by hand. */
function formatDifference(difference: number): string {
	return difference > 0 ? `+${difference}` : String(difference);
}

/**
 * What swapping would change, said before the swap happens.
 *
 * Comparing two lists of numbers is exactly the work a phone should do for the player, so the row
 * states the difference instead of showing the candidate's raw statistics next to the worn ones.
 */
function ComparedStats({candidate, equipped}: {candidate: ItemWithDetails; equipped: ItemWithDetails | null}): ReactNode {
	if (!isMainItem(candidate)) return <Fact label={i18n.t("app:equipment.stats.effect")} value={consumableDescription(candidate)} />;
	const worn = equipped && isMainItem(equipped) ? equipped : null;
	return <>{MAIN_STATS.map(stat => {
		const value = statValue(candidate[stat]);
		const difference = worn ? value - statValue(worn[stat]) : 0;
		return <Fact
			key={stat}
			label={i18n.t(`app:equipment.stats.${stat}`)}
			value={difference === 0 ? String(value) : i18n.t("app:equipment.stats.change", {value, difference: formatDifference(difference)})}
			unit={stat}
		/>;
	})}</>;
}

/** An item is equipped from its own row: a window over the list would hide what is being swapped. */
function ReserveEntry({item, slot, equipped, locked, expanded, category, onToggle, onConfirm}: {
	item: ItemWithDetails;
	slot: number;
	equipped: ItemWithDetails | null;
	locked: boolean;
	expanded: boolean;
	category: number;
	onToggle: () => void;
	onConfirm: (selection: EquipmentSelection) => void;
}): ReactNode {
	return <ExpandableEntry
		emblem={itemEmblem(item)}
		label={itemDisplayName(item)}
		caption={i18n.t(`items:raritiesWithoutEmote.${item.rarity}`)}
		end={<Text style={sectionStyles.caption}>{i18n.t("app:equipment.slot", {slot})}</Text>}
		dimmed={locked}
		expanded={expanded}
		onToggle={onToggle}
	>
		<ComparedStats candidate={item} equipped={equipped} />
		<ActionBanner
			icon={Check}
			label={i18n.t(`app:equipment.confirm.${EQUIP_ACTIONS.EQUIP}`)}
			pending={locked}
			onPress={(): void => onConfirm({
				request: makeFromClientPacket(EquipActionReq, {action: EQUIP_ACTIONS.EQUIP, itemCategory: category, slot}), item
			})}
		/>
	</ExpandableEntry>;
}

/** The worn item, and the one thing that can be done to it: put it away. */
function EquippedSection({category, locked, expanded, onToggle, onConfirm}: {
	category: EquipCategoryData;
	locked: boolean;
	expanded: boolean;
	onToggle: () => void;
	onConfirm: (selection: EquipmentSelection) => void;
}): ReactNode {
	const equipped = category.equippedItem;
	if (!equipped) return <ExpandableList><EmptyState>{i18n.t("app:equipment.noEquippedItem")}</EmptyState></ExpandableList>;
	return <>
		<Figures items={equippedFigures(equipped.details)} />
		<ExpandableList>
			<ExpandableEntry
				emblem={itemEmblem(equipped.details)}
				label={itemDisplayName(equipped.details)}
				caption={category.canDeposit
					? i18n.t(`items:raritiesWithoutEmote.${equipped.details.rarity}`)
					: i18n.t("app:equipment.errors.reserveFull")}
				end={<Text style={sectionStyles.caption}>{i18n.t("app:equipment.equipped")}</Text>}
				dimmed={locked || !category.canDeposit}
				expanded={expanded}
				onToggle={onToggle}
			>
				<ActionBanner
					icon={ArrowRight}
					label={i18n.t(`app:equipment.confirm.${EQUIP_ACTIONS.DEPOSIT}`)}
					pending={locked}
					{...category.canDeposit ? {} : {lock: {reason: i18n.t("app:equipment.errors.reserveFull")}}}
					onPress={(): void => onConfirm({
						request: makeFromClientPacket(EquipActionReq, {
							action: EQUIP_ACTIONS.DEPOSIT, itemCategory: category.category, slot: 0
						}),
						item: equipped.details
					})}
				/>
			</ExpandableEntry>
		</ExpandableList>
	</>;
}

function CategoryContent({category, locked, openKey, onOpen, onConfirm}: {
	category: EquipCategoryData;
	locked: boolean;
	openKey: string | undefined;
	onOpen: (key: string | undefined) => void;
	onConfirm: (selection: EquipmentSelection) => void;
}): ReactNode {
	const key = (suffix: string): string => `${category.category}-${suffix}`;
	const toggle = (suffix: string) => (): void => onOpen(openKey === key(suffix) ? undefined : key(suffix));
	return <>
		<SectionHeader first>{i18n.t("app:equipment.worn")}</SectionHeader>
		<EquippedSection
			category={category}
			locked={locked}
			expanded={openKey === key("equipped")}
			onToggle={toggle("equipped")}
			onConfirm={onConfirm}
		/>
		<SectionHeader action={{hint: i18n.t("app:equipment.capacity", {count: category.reserveItems.length, max: category.maxReserveSlots})}}>
			{i18n.t("app:equipment.reserve")}
		</SectionHeader>
		<ExpandableList>
			{category.reserveItems.length > 0
				? category.reserveItems.map(entry => <ReserveEntry
					key={entry.slot}
					item={entry.details}
					slot={entry.slot}
					equipped={category.equippedItem?.details ?? null}
					locked={locked}
					expanded={openKey === key(String(entry.slot))}
					category={category.category}
					onToggle={toggle(String(entry.slot))}
					onConfirm={onConfirm}
				/>)
				: <EmptyState>{i18n.t("app:equipment.emptyReserve")}</EmptyState>}
		</ExpandableList>
	</>;
}

/**
 * Equipment, one category at a time.
 *
 * Showing the four categories at once turned the screen into a long scroll where the item being
 * worn and the ones that could replace it were never visible together. A phone shows one decision.
 */
export function EquipCollector({collector, onChoose, submitting}: {
	collector: EquipCollectorPacket; onChoose: (index: number) => void; submitting: boolean;
}): ReactNode {
	const {categories, pending, error, submit} = useEquipmentActions(collector.data.data.categories);
	const [selected, setSelected] = useState<string>();
	const [openKey, setOpenKey] = useState<string>();
	const locked = pending || submitting;
	const category = categories.find(entry => String(entry.category) === selected) ?? categories[0];
	const closeIndex = collector.reactions.findIndex(reaction => reaction.type === EQUIP_REACTION_KINDS.CLOSE);
	const close = (): void => {
		if (!locked && closeIndex >= 0) onChoose(closeIndex);
	};
	const confirm = (selection: EquipmentSelection): void => {
		if (locked) return;
		setOpenKey(undefined);
		submit(selection.request).catch(console.error);
	};
	return <Sheet
		caption={i18n.t("app:equipment.eyebrow")}
		title={i18n.t("app:equipment.title")}
		closeLabel={i18n.t("app:common.back")}
		onClose={close}
	>
		{error ? <Note>{i18n.t(error)}</Note> : null}
		<SegmentedControl
			label={i18n.t("app:equipment.title")}
			value={String(category?.category)}
			onChange={(value): void => {
				setSelected(value);
				setOpenKey(undefined);
			}}
			options={categories.map(entry => ({
				value: String(entry.category),
				label: itemCategoryLabel(entry.category),
				...AppIcons.getIconOrNull(`itemCategories.${entry.category}`) === null
					? {}
					: {icon: AppIcons.getIcon(`itemCategories.${entry.category}`)}
			}))}
		/>
		{category ? <CategoryContent
			category={category}
			locked={locked}
			openKey={openKey}
			onOpen={setOpenKey}
			onConfirm={confirm}
		/> : null}
	</Sheet>;
}
