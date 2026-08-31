import {i18n} from "@/src/translations/i18n";

/** The numeric ids are defined by Lib's ShopItemType enum and are stable on the wire. */
const SHOP_ITEM_KEYS = [
	"dailyPotion", "randomItem", "alterationHeal", "fullRegen", "slotExtension", "moneyMouthBadge",
	"commonFood", "herbivorousFood", "carnivorousFood", "ultimateFood", "money", "treasure", "kingsFavor",
	"skipMission", "lovePointsValue", "smallGuildXp", "energyHeal", "bigGuildXp", "questMasterBadge", "token",
	"plantSlotExtension", "weeklyPlantTier1", "weeklyPlantTier2", "weeklyPlantTier3", "marketAnalysis",
	"woodCommonBundle", "woodUncommonBundle", "randomMaterialPack", "remoteHarvestTalisman", "tokenCharity"
] as const;

type ShopItemReference = {shopItemId: number};

function shopItemKey({shopItemId}: ShopItemReference): string {
	return SHOP_ITEM_KEYS[shopItemId] ?? `item-${shopItemId}`;
}

export function shopItemName(reference: ShopItemReference): string {
	const key = shopItemKey(reference);
	// The daily potion label is built from the category in Discord. There is no
	// `shopItems.dailyPotion.name` translation, so use the dedicated app label.
	return key === "dailyPotion"
		? i18n.t("app:city.shop.dailyPotion")
		: i18n.t(`commands:shop.shopItems.${key}.name`);
}
