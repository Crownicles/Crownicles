import { ItemCategory } from "../../../../Lib/src/constants/ItemConstants";
import { GenericItem } from "../../data/GenericItem";

export type ItemSlotData = {
	itemId: number;
	itemLevel: number;
	itemEnchantmentId: string | null;
	remainingPotionUsages: number | null;
};

type MutableItemSlotData = ItemSlotData & {
	slot?: number;
};

export function buildNewItemSlotData(
	item: GenericItem,
	itemLevel = 0,
	itemEnchantmentId: string | null = null
): ItemSlotData {
	const category = item.getCategory();
	const hasEquipmentAttributes = category === ItemCategory.WEAPON || category === ItemCategory.ARMOR;
	return {
		itemId: item.id,
		itemLevel: hasEquipmentAttributes ? itemLevel : 0,
		itemEnchantmentId: hasEquipmentAttributes ? itemEnchantmentId : null,
		remainingPotionUsages: null
	};
}

export function copyItemSlotData(target: MutableItemSlotData, source: ItemSlotData): void {
	target.itemId = source.itemId;
	target.itemLevel = source.itemLevel;
	target.itemEnchantmentId = source.itemEnchantmentId;
	target.remainingPotionUsages = source.remainingPotionUsages;
}

export function clearItemSlotData(target: MutableItemSlotData): void {
	copyItemSlotData(target, {
		itemId: 0,
		itemLevel: 0,
		itemEnchantmentId: null,
		remainingPotionUsages: null
	});
}

export function itemSlotDataEquals(first: ItemSlotData, second: ItemSlotData): boolean {
	return first.itemId === second.itemId
		&& first.itemLevel === second.itemLevel
		&& first.itemEnchantmentId === second.itemEnchantmentId
		&& first.remainingPotionUsages === second.remainingPotionUsages;
}

export function findFirstFreeBackupSlot(slots: { slot: number }[], maxSlots: number): number | null {
	const occupiedSlots = new Set(slots.map(slot => slot.slot));
	for (let slot = 1; slot < maxSlots; slot++) {
		if (!occupiedSlots.has(slot)) {
			return slot;
		}
	}
	return null;
}
