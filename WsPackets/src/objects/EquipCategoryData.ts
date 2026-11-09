import { ItemWithDetails } from "./ItemWithDetails";

export const EQUIP_ACTIONS = {
	EQUIP: "equip",
	DEPOSIT: "deposit"
} as const;

export type EquipAction = typeof EQUIP_ACTIONS[keyof typeof EQUIP_ACTIONS];

export const EQUIP_ERRORS = {
	INVALID: "invalid",
	NO_ITEM: "noItem",
	RESERVE_FULL: "reserveFull"
} as const;

export type EquipError = typeof EQUIP_ERRORS[keyof typeof EQUIP_ERRORS];

export type EquipCategoryData = {
	category: ItemWithDetails["itemCategory"];
	equippedItem: {
		details: ItemWithDetails;
	} | null;
	reserveItems: {
		slot: number;
		details: ItemWithDetails;
	}[];
	maxReserveSlots: number;
	canDeposit: boolean;
};
