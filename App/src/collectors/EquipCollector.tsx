import {ReactNode, useState} from "react";
import {Text} from "react-native";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {EQUIP_DATA_KINDS, EQUIP_REACTION_KINDS} from "ws-packets/src/fromServer/collectors";
import {EQUIP_ACTIONS, EquipCategoryData} from "ws-packets/src/objects/EquipCategoryData";
import {ItemWithDetails} from "ws-packets/src/objects/ItemWithDetails";
import {EquipActionReq} from "ws-packets/src/fromClient/EquipActionReq";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {useEquipmentActions} from "@/src/store/useEquipmentActions";
import {EmptyState, Note, SectionHeader} from "@/src/design/Primitives";
import {Segment, SegmentedControl} from "@/src/design/SegmentedControl";
import {
	ActionBanner, ExpandableEntry, ExpandableList, useSectionStyles, Sheet
} from "@/src/design/Sections";
import {ArrowRight, Check} from "@/src/design/FightIcons";
import {ExpandedEntry, useExpandedEntry} from "@/src/design/useExpandedEntry";
import {AppIcons} from "@/src/AppIcons";
import {itemDisplayName, itemCategoryLabel} from "@/src/collectors/CollectorLabels";
import {inventoryItemDetails, inventoryItemEmblem} from "@/src/components/InventoryItemRow";
import {ItemDetails} from "@/src/components/ItemDetails";
import {i18n} from "@/src/translations/i18n";

type EquipCollectorPacket = ReactionCollectorCreation & {data: Extract<ReactionCollectorCreation["data"], {type: typeof EQUIP_DATA_KINDS.COLLECTOR}>};
type EquipmentSelection = {request: EquipActionReq; item: ItemWithDetails};

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
	const sectionStyles = useSectionStyles();
	return <ExpandableEntry
		emblem={inventoryItemEmblem(item)}
		label={itemDisplayName(item)}
		caption={inventoryItemDetails(item)}
		end={<Text style={sectionStyles.caption}>{i18n.t("app:equipment.slot", {slot})}</Text>}
		dimmed={locked}
		expanded={expanded}
		onToggle={onToggle}
	>
		<ItemDetails item={item} {...equipped ? {reference: equipped} : {}} />
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
	const sectionStyles = useSectionStyles();
	const equipped = category.equippedItem;
	if (!equipped) return <ExpandableList><EmptyState>{i18n.t("app:equipment.noEquippedItem")}</EmptyState></ExpandableList>;
	return <>
		<ItemDetails item={equipped.details} />
		<ExpandableList>
			<ExpandableEntry
				emblem={inventoryItemEmblem(equipped.details)}
				label={itemDisplayName(equipped.details)}
				caption={category.canDeposit
					? inventoryItemDetails(equipped.details)
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

function CategoryContent({category, locked, unfolding, onConfirm}: {
	category: EquipCategoryData;
	locked: boolean;
	unfolding: ExpandedEntry<string>;
	onConfirm: (selection: EquipmentSelection) => void;
}): ReactNode {
	const key = (suffix: string): string => `${category.category}-${suffix}`;
	const toggle = (suffix: string) => (): void => unfolding.toggle(key(suffix));
	return <>
		<SectionHeader first>{i18n.t("app:equipment.worn")}</SectionHeader>
		<EquippedSection
			category={category}
			locked={locked}
			expanded={unfolding.isExpanded(key("equipped"))}
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
					expanded={unfolding.isExpanded(key(String(entry.slot)))}
					category={category.category}
					onToggle={toggle(String(entry.slot))}
					onConfirm={onConfirm}
				/>)
				: <EmptyState>{i18n.t("app:equipment.emptyReserve")}</EmptyState>}
		</ExpandableList>
	</>;
}

function categoryOptions(categories: EquipCategoryData[]): Segment<string>[] {
	return categories.map(entry => {
		const icon = AppIcons.getIconOrNull(`itemCategories.${entry.category}`);
		return {
			value: String(entry.category),
			label: itemCategoryLabel(entry.category),
			...icon === null ? {} : {icon}
		};
	});
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
	const unfolding = useExpandedEntry<string>();
	const locked = pending || submitting;
	const category = categories.find(entry => String(entry.category) === selected) ?? categories[0];
	const closeIndex = collector.reactions.findIndex(reaction => reaction.type === EQUIP_REACTION_KINDS.CLOSE);
	const close = (): void => {
		if (!locked && closeIndex >= 0) onChoose(closeIndex);
	};
	const confirm = (selection: EquipmentSelection): void => {
		if (locked) return;
		unfolding.collapse();
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
				unfolding.collapse();
			}}
			options={categoryOptions(categories)}
		/>
		{category ? <CategoryContent
			category={category}
			locked={locked}
			unfolding={unfolding}
			onConfirm={confirm}
		/> : null}
	</Sheet>;
}
