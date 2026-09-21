import {ReactNode, useState} from "react";
import {Modal, Text} from "react-native";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {EQUIP_DATA_KINDS, EQUIP_REACTION_KINDS} from "ws-packets/src/fromServer/collectors";
import {EQUIP_ACTIONS, EquipCategoryData} from "ws-packets/src/objects/EquipCategoryData";
import {ItemWithDetails} from "ws-packets/src/objects/ItemWithDetails";
import {EquipActionReq} from "ws-packets/src/fromClient/EquipActionReq";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {useEquipmentActions} from "@/src/store/useEquipmentActions";
import {Note, Screen, SectionHeader} from "@/src/design/Primitives";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {
	ActionBanner, EntryRow, ExpandableEntry, ExpandableList, ModalSurface, sectionStyles, Standing
} from "@/src/design/Sections";
import {Check} from "@/src/design/FightIcons";
import {AppIcons} from "@/src/AppIcons";
import {CollectorChoices} from "@/src/collectors/CollectorPrompt";
import {itemDisplayName, itemIconPath, itemCategoryLabel} from "@/src/collectors/CollectorLabels";
import {i18n} from "@/src/translations/i18n";

type EquipCollectorPacket = ReactionCollectorCreation & {data: Extract<ReactionCollectorCreation["data"], {type: typeof EQUIP_DATA_KINDS.COLLECTOR}>};
type EquipmentSelection = {request: EquipActionReq; item: ItemWithDetails};
type EquipmentCategoryProps = {
	category: EquipCategoryData;
	locked: boolean;
	openKey: string | undefined;
	onOpen: (key: string | undefined) => void;
	onConfirm: (selection: EquipmentSelection) => void;
};

function itemEmblem(item: ItemWithDetails): ReactNode {
	const path = itemIconPath(item);
	const icon = path ? AppIcons.getIconOrNull(path) : null;
	return icon ? <TwemojiIcon emoji={icon} size={Theme.dimensions.headerIcon} /> : undefined;
}

/** An item is equipped from its own row: a window over the list would hide what is being swapped. */
function EquipmentChoice({item, slot, action, category, locked, expanded, onToggle, onConfirm}: {
	item: ItemWithDetails;
	slot: number;
	action: typeof EQUIP_ACTIONS[keyof typeof EQUIP_ACTIONS];
	category: number;
	locked: boolean;
	expanded: boolean;
	onToggle: () => void;
	onConfirm: (selection: EquipmentSelection) => void;
}): ReactNode {
	return <ExpandableEntry
		emblem={itemEmblem(item)}
		label={itemDisplayName(item)}
		caption={i18n.t(`items:raritiesWithoutEmote.${item.rarity}`)}
		end={<Text style={sectionStyles.caption}>{i18n.t(action === EQUIP_ACTIONS.EQUIP ? "app:equipment.slot" : "app:equipment.equipped", {slot})}</Text>}
		dimmed={locked}
		expanded={expanded}
		onToggle={onToggle}
	>
		<ActionBanner
			icon={Check}
			label={i18n.t(`app:equipment.confirm.${action}`)}
			pending={locked}
			onPress={(): void => onConfirm({
				request: makeFromClientPacket(EquipActionReq, {action, itemCategory: category, slot}), item
			})}
		/>
	</ExpandableEntry>;
}

function EquipmentCategory({category, locked, openKey, onOpen, onConfirm}: EquipmentCategoryProps): ReactNode {
	const {equippedItem, reserveItems, canDeposit} = category;
	const key = (suffix: string): string => `${category.category}-${suffix}`;
	return <>
		<SectionHeader>{itemCategoryLabel(category.category)}</SectionHeader>
		<ExpandableList>
			{equippedItem
				? canDeposit
					? <EquipmentChoice
						item={equippedItem.details}
						slot={0}
						action={EQUIP_ACTIONS.DEPOSIT}
						category={category.category}
						locked={locked}
						expanded={openKey === key("equipped")}
						onToggle={(): void => onOpen(openKey === key("equipped") ? undefined : key("equipped"))}
						onConfirm={onConfirm}
					/>
					: <EntryRow
						title={itemDisplayName(equippedItem.details)}
						subtitle={i18n.t("app:equipment.errors.reserveFull")}
						emblem={itemEmblem(equippedItem.details)}
						end={i18n.t("app:equipment.equipped")}
					/>
				: <Note>{i18n.t("app:equipment.noEquippedItem")}</Note>}
			{reserveItems.map(item => <EquipmentChoice
				key={item.slot}
				item={item.details}
				slot={item.slot}
				action={EQUIP_ACTIONS.EQUIP}
				category={category.category}
				locked={locked}
				expanded={openKey === key(String(item.slot))}
				onToggle={(): void => onOpen(openKey === key(String(item.slot)) ? undefined : key(String(item.slot)))}
				onConfirm={onConfirm}
			/>)}
			{reserveItems.length === 0 ? <Note>{i18n.t("app:equipment.emptyReserve")}</Note> : null}
		</ExpandableList>
		<Note>{i18n.t("app:equipment.capacity", {count: reserveItems.length, max: category.maxReserveSlots})}</Note>
	</>;
}

export function EquipCollector({collector, onChoose, submitting}: {
	collector: EquipCollectorPacket; onChoose: (index: number) => void; submitting: boolean;
}): ReactNode {
	const {categories, pending, error, submit} = useEquipmentActions(collector.data.data.categories);
	const [openKey, setOpenKey] = useState<string>();
	const locked = pending || submitting;
	const closeIndex = collector.reactions.findIndex(reaction => reaction.type === EQUIP_REACTION_KINDS.CLOSE);
	const close = (): void => {
		if (!locked && closeIndex >= 0) onChoose(closeIndex);
	};
	const confirm = (selection: EquipmentSelection): void => {
		if (locked) return;
		setOpenKey(undefined);
		submit(selection.request).catch(console.error);
	};
	return <Modal visible animationType="slide" onRequestClose={close}>
		<ModalSurface>
			<Screen>
				<Standing caption={i18n.t("app:equipment.eyebrow")} title={i18n.t("app:equipment.title")} />
				{error ? <Note>{i18n.t(error)}</Note> : null}
				{categories.map(category => <EquipmentCategory
					key={category.category}
					category={category}
					locked={locked}
					openKey={openKey}
					onOpen={setOpenKey}
					onConfirm={confirm}
				/>)}
				<CollectorChoices collector={collector} onChoose={onChoose} submitting={locked} />
			</Screen>
		</ModalSurface>
	</Modal>;
}
