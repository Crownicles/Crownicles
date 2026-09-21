import {ReactNode, useState} from "react";
import {Modal} from "react-native";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {EQUIP_DATA_KINDS, EQUIP_REACTION_KINDS} from "ws-packets/src/fromServer/collectors";
import {EQUIP_ACTIONS, EquipCategoryData} from "ws-packets/src/objects/EquipCategoryData";
import {ItemWithDetails} from "ws-packets/src/objects/ItemWithDetails";
import {EquipActionReq} from "ws-packets/src/fromClient/EquipActionReq";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {useEquipmentActions} from "@/src/store/useEquipmentActions";
import {Button, ButtonRow, Confirmation, Note, Screen, SectionHeader} from "@/src/design/Primitives";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {EntryRow, ExpandableList, ModalSurface, Standing} from "@/src/design/Sections";
import {AppIcons} from "@/src/AppIcons";
import {CollectorChoices} from "@/src/collectors/CollectorPrompt";
import {itemDisplayName, itemIconPath, itemCategoryLabel} from "@/src/collectors/CollectorLabels";
import {i18n} from "@/src/translations/i18n";

type EquipCollectorPacket = ReactionCollectorCreation & {data: Extract<ReactionCollectorCreation["data"], {type: typeof EQUIP_DATA_KINDS.COLLECTOR}>};
type EquipmentSelection = {request: EquipActionReq; item: ItemWithDetails};
type EquipmentCategoryProps = {category: EquipCategoryData; locked: boolean; onSelect: (selection: EquipmentSelection) => void};


function EquipmentItem({item, end, onPress, disabled}: {
	item: ItemWithDetails; end: string; onPress?: () => void; disabled?: boolean;
}): ReactNode {
	const path = itemIconPath(item);
	const icon = path ? AppIcons.getIconOrNull(path) : null;
	return <EntryRow
		title={itemDisplayName(item)}
		subtitle={i18n.t(`items:raritiesWithoutEmote.${item.rarity}`)}
		emblem={icon ? <TwemojiIcon emoji={icon} size={Theme.dimensions.headerIcon} /> : undefined}
		end={end}
		onPress={onPress}
		disabled={disabled} 
	/>;
}

function EquipmentCategory({category, locked, onSelect}: EquipmentCategoryProps): ReactNode {
	const {equippedItem, reserveItems, canDeposit} = category;
	return <>
		<SectionHeader>{itemCategoryLabel(category.category)}</SectionHeader>
		<ExpandableList>
			{equippedItem ? <EquipmentItem item={equippedItem.details} end={i18n.t("app:equipment.equipped")} /> : <Note>{i18n.t("app:equipment.noEquippedItem")}</Note>}
			{reserveItems.map(item => <EquipmentItem
				key={item.slot}
				item={item.details}
				end={i18n.t("app:equipment.slot", {slot: item.slot})}
				disabled={locked}
				onPress={(): void => onSelect({request: makeFromClientPacket(EquipActionReq, {action: EQUIP_ACTIONS.EQUIP, itemCategory: category.category, slot: item.slot}), item: item.details})}
			/>)}
			{reserveItems.length === 0 ? <Note>{i18n.t("app:equipment.emptyReserve")}</Note> : null}
		</ExpandableList>
		<Note>{i18n.t("app:equipment.capacity", {count: reserveItems.length, max: category.maxReserveSlots})}</Note>
		{equippedItem ? <ButtonRow><Button
			disabled={locked || !canDeposit}
			onPress={(): void => onSelect({request: makeFromClientPacket(EquipActionReq, {action: EQUIP_ACTIONS.DEPOSIT, itemCategory: category.category, slot: 0}), item: equippedItem.details})}
		>{i18n.t(canDeposit ? "app:equipment.deposit" : "app:equipment.errors.reserveFull")}</Button></ButtonRow> : null}
	</>;
}

export function EquipCollector({collector, onChoose, submitting}: {
	collector: EquipCollectorPacket; onChoose: (index: number) => void; submitting: boolean;
}): ReactNode {
	const {categories, pending, error, submit} = useEquipmentActions(collector.data.data.categories);
	const [selection, setSelection] = useState<EquipmentSelection | null>(null);
	const locked = pending || submitting;
	const closeIndex = collector.reactions.findIndex(reaction => reaction.type === EQUIP_REACTION_KINDS.CLOSE);
	const close = (): void => { if (!locked && closeIndex >= 0) onChoose(closeIndex); };
	const confirm = async (): Promise<void> => {
		if (!selection || locked) return;
		const {request} = selection;
		setSelection(null);
		await submit(request);
	};
	return <Modal visible animationType="slide" onRequestClose={close}>
		<ModalSurface>
			<Screen>
				<Standing caption={i18n.t("app:equipment.eyebrow")} title={i18n.t("app:equipment.title")} />
				{error ? <Note>{i18n.t(error)}</Note> : null}
				{categories.map(category => <EquipmentCategory key={category.category} category={category} locked={locked} onSelect={setSelection} />)}
				<CollectorChoices collector={collector} onChoose={onChoose} submitting={locked} />
			</Screen>
			{selection ? <Confirmation
				title={i18n.t(`app:equipment.confirm.${selection.request.action}`)}
				message={itemDisplayName(selection.item)}
				onRequestClose={(): void => setSelection(null)}
			><ButtonRow>
				<Button variant="primary" disabled={locked} onPress={confirm}>{i18n.t("app:collector.accept")}</Button>
				<Button disabled={locked} onPress={(): void => setSelection(null)}>{i18n.t("app:collector.refuse")}</Button>
			</ButtonRow></Confirmation> : null}
		</ModalSurface>
	</Modal>;
}
