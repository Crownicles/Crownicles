export const ScrapDealerMenuIds = {
	SCRAP_DEALER_MENU: "SCRAP_DEALER_MENU",
	BACK_TO_CITY: "SCRAP_DEALER_BACK_TO_CITY",
	BACK_TO_LIST: "SCRAP_DEALER_BACK_TO_LIST",
	SELECT_ITEM_PREFIX: "SCRAP_DEALER_SELECT_ITEM_",
	CONFIRM_RECYCLE: "SCRAP_DEALER_CONFIRM_RECYCLE"
} as const;

export function getScrapDealerDetailMenuId(itemIndex: number): string {
	return `${ScrapDealerMenuIds.SCRAP_DEALER_MENU}_DETAIL_${itemIndex}`;
}
