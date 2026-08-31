import {ReactNode} from "react";
import {
	CITY_REACTION_KINDS,
	ReactionCollectorReaction
} from "ws-packets/src/fromServer/collectors";
import {AppIcons} from "@/src/AppIcons";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";

const CITY_ICON_PATHS: Partial<Record<ReactionCollectorReaction["type"], string>> = {
	[CITY_REACTION_KINDS.EXIT]: "city.exit",
	[CITY_REACTION_KINDS.INN_MEAL]: "city.inn",
	[CITY_REACTION_KINDS.INN_ROOM]: "city.inn",
	[CITY_REACTION_KINDS.ENCHANT]: "city.services.enchanter",
	[CITY_REACTION_KINDS.BUY_HOME]: "city.manageHome",
	[CITY_REACTION_KINDS.UPGRADE_HOME]: "city.manageHome",
	[CITY_REACTION_KINDS.MOVE_HOME]: "city.manageHome",
	[CITY_REACTION_KINDS.HOME_MENU]: "city.home.5",
	[CITY_REACTION_KINDS.HOME_BED]: "city.homeUpgrades.bed",
	[CITY_REACTION_KINDS.UPGRADE_ITEM]: "city.homeUpgrades.upgradeEquipment",
	[CITY_REACTION_KINDS.BLACKSMITH_MENU]: "city.services.blacksmith",
	[CITY_REACTION_KINDS.BLACKSMITH_UPGRADE]: "city.services.blacksmith",
	[CITY_REACTION_KINDS.BLACKSMITH_DISENCHANT]: "city.blacksmith.disenchant",
	[CITY_REACTION_KINDS.SCRAP_DEALER_MENU]: "city.services.scrapDealer",
	[CITY_REACTION_KINDS.SCRAP_DEALER_RECYCLE]: "city.services.scrapDealer",
	[CITY_REACTION_KINDS.ROYAL_BLACKSMITH_MENU]: "city.services.royalBlacksmith",
	[CITY_REACTION_KINDS.ROYAL_BLACKSMITH_UPGRADE]: "city.services.royalBlacksmith",
	[CITY_REACTION_KINDS.GARDEN_HARVEST]: "city.homeUpgrades.garden",
	[CITY_REACTION_KINDS.GARDEN_WATER]: "city.homeUpgrades.garden",
	[CITY_REACTION_KINDS.GARDEN_COMPOST]: "city.homeUpgrades.garden",
	[CITY_REACTION_KINDS.GUILD_DOMAIN_MENU]: "city.guildDomain.menu",
	[CITY_REACTION_KINDS.GUILD_DOMAIN_NOTARY]: "city.guildDomainNotary",
	[CITY_REACTION_KINDS.APARTMENT_BUY]: "city.apartmentNotary.menu",
	[CITY_REACTION_KINDS.APARTMENT_CLAIM_RENT]: "city.apartmentNotary.menu"
};

export function iconForPath(iconPath: string): ReactNode | undefined {
	const emoji = AppIcons.getIconOrNull(iconPath);
	return emoji ? <TwemojiIcon emoji={emoji} size={Theme.fontSize.rowTitle} /> : undefined;
}

export function cityIconPath(reaction: ReactionCollectorReaction): string | undefined {
	return reaction.type === CITY_REACTION_KINDS.SHOP ? `city.shops.${reaction.data.shopId}` : CITY_ICON_PATHS[reaction.type];
}
