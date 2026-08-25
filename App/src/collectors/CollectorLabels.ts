import {
	BIG_EVENT_DATA_KINDS, BIG_EVENT_REACTION_KINDS,
	DRINK_DATA_KINDS, DRINK_REACTION_KINDS,
	GENERIC_REACTION_KINDS, SMALL_EVENT_DATA_KINDS, SMALL_EVENT_REACTION_KINDS,
	ITEM_DATA_KINDS, ITEM_REACTION_KINDS,
	SMALL_EVENT_BAD_PET_ACTION_IDS, SMALL_EVENT_GOBLET_IDS, SMALL_EVENT_GOBLET_STRATEGIES,
	SmallEventGobletId, SmallEventGobletStrategy,
	ReactionCollectorData, ReactionCollectorReaction
} from "ws-packets/src/fromServer/collectors";
import {ItemWithDetails} from "ws-packets/src/objects/ItemWithDetails";
import {i18n} from "@/src/translations/i18n";
import {AppIcons} from "@/src/AppIcons";

const SEX_CONTEXTS = {
	MALE: "male",
	FEMALE: "female"
} as const;

const ITEM_TYPES_BY_CATEGORY = [
	"weapon",
	"armor",
	"potion",
	"object"
] as const;

const BAD_PET_ACTIONS_WITH_SEX = new Set([
	"intimidate",
	"flee",
	"hide",
	"protect",
	"calm",
	"imposer",
	"energize"
]);

const BAD_PET_ACTION_IDS = new Set(Object.values(SMALL_EVENT_BAD_PET_ACTION_IDS));

const GOBLET_STRATEGIES_BY_ID: Record<SmallEventGobletId, SmallEventGobletStrategy> = {
	[SMALL_EVENT_GOBLET_IDS.METAL]: SMALL_EVENT_GOBLET_STRATEGIES.CLASSIC,
	[SMALL_EVENT_GOBLET_IDS.BIGGEST]: SMALL_EVENT_GOBLET_STRATEGIES.SAFE,
	[SMALL_EVENT_GOBLET_IDS.SPARKLING]: SMALL_EVENT_GOBLET_STRATEGIES.RISKY,
	[SMALL_EVENT_GOBLET_IDS.CRACKED]: SMALL_EVENT_GOBLET_STRATEGIES.GAMBLER
};

const GARDENER_REWARD_CONDITION_KEYS = new Set([
	"free",
	"paid",
	"paidAccepted",
	"moon",
	"night",
	"herbivorePet",
	"legendaryHerbivorePet",
	"mage",
	"firePet",
	"fireItem",
	"carnivorePet"
]);

function sexContext(sex: string): string {
	return sex === "f" ? SEX_CONTEXTS.FEMALE : SEX_CONTEXTS.MALE;
}

function withIcon(iconPath: string, label: string): string {
	const icon = AppIcons.getIconOrNull(iconPath);
	return icon ? `${icon} ${label}` : label;
}

function smallEventTitle(titleKey: string, iconPath: string): string {
	return withIcon(iconPath, i18n.t(titleKey));
}

function badPetActionTranslationKey(actionId: string, sex: string): string {
	const suffix = BAD_PET_ACTIONS_WITH_SEX.has(actionId) ? `_${sexContext(sex)}` : "";
	return `smallEvents:badPet.choices.${actionId}${suffix}`;
}

function badPetDisplayName(petId: number, petNickname: string | undefined, sex: string): string {
	return petNickname ?? i18n.t(`models:pets:${petId}`, { context: sexContext(sex) });
}

function isKnownGoblet(id: string | undefined, strategy?: string): boolean {
	if (id === undefined || !Object.values(SMALL_EVENT_GOBLET_IDS).includes(id as SmallEventGobletId)) {
		return false;
	}
	return strategy === undefined || GOBLET_STRATEGIES_BY_ID[id as SmallEventGobletId] === strategy;
}

function gardenerRewardConditionKey(conditionKey: string): string {
	return GARDENER_REWARD_CONDITION_KEYS.has(conditionKey) ? conditionKey : "paid";
}

function gardenerSeedDisplay(seedId: number): string {
	return withIcon(`plants.${seedId}`, i18n.t(`models:plants.${seedId}`));
}

function interactOtherPlayersDescription(keycloakId: string, rank: number | undefined): string {
	if (keycloakId.length === 0) {
		return i18n.t("app:collector.descriptions.unknownPlayer");
	}
	return rank === undefined
		? i18n.t("app:collector.descriptions.interactOtherPlayers")
		: i18n.t("app:collector.descriptions.interactOtherPlayersRanked", { rank });
}

function itemTypeFromCategory(category: number): typeof ITEM_TYPES_BY_CATEGORY[number] | null {
	return ITEM_TYPES_BY_CATEGORY[category] ?? null;
}

function itemDisplayName(item: { id: number; category: number } | ItemWithDetails): string {
	const category = "category" in item ? item.category : item.itemCategory;
	const itemType = itemTypeFromCategory(category);
	return itemType
		? i18n.t(`models:${itemType}s.${item.id}`)
		: i18n.t("app:collector.descriptions.unknownItem");
}

function itemIconPath(item: ItemWithDetails): string | null {
	const itemType = itemTypeFromCategory(item.itemCategory);
	return itemType ? `${itemType}s.${item.id}` : null;
}

/**
 * Turns the protocol kinds into what the player reads.
 *
 * Both switches are exhaustive over the discriminated unions, so adding a collector family to
 * `WsPackets` without giving it a wording breaks the build here rather than showing a blank button.
 */

export function collectorTitle(data: ReactionCollectorData): string {
	switch (data.type) {
		case DRINK_DATA_KINDS.COLLECTOR:
			return i18n.t("app:collector.titles.drink");
		case BIG_EVENT_DATA_KINDS.COLLECTOR:
			return i18n.t("app:collector.titles.bigEvent");
		case SMALL_EVENT_DATA_KINDS.ALTAR:
			return smallEventTitle("app:collector.titles.altar", "smallEvents.altar");
		case SMALL_EVENT_DATA_KINDS.BAD_PET:
			return smallEventTitle("app:collector.titles.badPet", "smallEvents.badPet");
		case SMALL_EVENT_DATA_KINDS.GARDENER:
			return smallEventTitle("app:collector.titles.gardener", "smallEvents.gardener");
		case SMALL_EVENT_DATA_KINDS.GOBLETS_GAME:
			return smallEventTitle("app:collector.titles.gobletsGame", "smallEvents.gobletsGame");
		case SMALL_EVENT_DATA_KINDS.INTERACT_OTHER_PLAYERS:
			return smallEventTitle("app:collector.titles.interactOtherPlayers", "smallEvents.interactOtherPlayers");
		case SMALL_EVENT_DATA_KINDS.LIMOGES:
			return smallEventTitle("app:collector.titles.limoges", "smallEvents.limoges");
		case SMALL_EVENT_DATA_KINDS.LOTTERY:
			return smallEventTitle("app:collector.titles.lottery", "smallEvents.lottery");
		case SMALL_EVENT_DATA_KINDS.PET_FOOD:
			return smallEventTitle("app:collector.titles.petFood", "smallEvents.petFood");
		case SMALL_EVENT_DATA_KINDS.WITCH:
			return smallEventTitle("app:collector.titles.witch", "smallEvents.witch");
		case ITEM_DATA_KINDS.CHOICE:
			return smallEventTitle("app:collector.titles.itemChoice", "collectors.warning");
		case ITEM_DATA_KINDS.ACCEPT:
			return smallEventTitle("app:collector.titles.itemAccept", "collectors.warning");
		case "unknown":
			return i18n.t("app:collector.titles.unknown");
		default: {
			const unhandled: never = data;
			return unhandled;
		}
	}
}

export function collectorDescription(data: ReactionCollectorData): string | undefined {
	switch (data.type) {
		case BIG_EVENT_DATA_KINDS.COLLECTOR:
			return i18n.t(`events:${data.data.eventId}.text`);
		case DRINK_DATA_KINDS.COLLECTOR:
		case "unknown":
			return undefined;
		case SMALL_EVENT_DATA_KINDS.ALTAR:
			return i18n.t("smallEvents:altar.intro.0", {
				poolAmount: data.data.poolAmount,
				poolThreshold: data.data.poolThreshold,
				moneyEmote: AppIcons.getIcon("unitValues.money")
			});
		case SMALL_EVENT_DATA_KINDS.BAD_PET:
			return i18n.t(`smallEvents:badPet.intro`, {
				context: sexContext(data.data.sex),
				pet: badPetDisplayName(data.data.petId, data.data.petNickname, data.data.sex)
			});
		case SMALL_EVENT_DATA_KINDS.GARDENER:
			return `${i18n.t(`smallEvents:gardener.stories.${data.data.isFirstEncounter === true ? "first" : "recurring"}.0`)} ${i18n.t(`smallEvents:gardener.rewards.seed.${gardenerRewardConditionKey(data.data.conditionKey)}.0`, {
				cost: data.data.cost
			})} ${i18n.t("app:collector.descriptions.gardenerSeed", {
				seed: gardenerSeedDisplay(data.data.seedId)
			})}`;
		case SMALL_EVENT_DATA_KINDS.GOBLETS_GAME:
			return i18n.t("smallEvents:gobletsGame.intro.0");
		case SMALL_EVENT_DATA_KINDS.INTERACT_OTHER_PLAYERS:
			return interactOtherPlayersDescription(data.data.keycloakId, data.data.rank);
		case SMALL_EVENT_DATA_KINDS.LIMOGES:
			return i18n.t(`smallEvents:limoges.questions.${data.data.questionId}`);
		case SMALL_EVENT_DATA_KINDS.LOTTERY:
			return i18n.t("smallEvents:lottery.intro");
		case SMALL_EVENT_DATA_KINDS.PET_FOOD:
			return i18n.t(`smallEvents:petFood.intro.${data.data.foodType}_${data.data.petSex === "f" ? "female" : "male"}`);
		case SMALL_EVENT_DATA_KINDS.WITCH:
			return `${i18n.t("smallEvents:witch.intro.0")}${i18n.t("smallEvents:witch.description.0")}${i18n.t("smallEvents:witch.situation.0")}`;
		case ITEM_DATA_KINDS.CHOICE:
			return i18n.t("app:collector.descriptions.itemChoice", {
				item: itemDisplayName(data.data.item)
			});
		case ITEM_DATA_KINDS.ACCEPT:
			return i18n.t("app:collector.descriptions.itemAccept", {
				item: itemDisplayName(data.data.itemWithDetails)
			});
		default: {
			const unhandled: never = data;
			return unhandled;
		}
	}
}

function eventReactionIcon(eventId: number, possibilityName: string): string | null {
	return AppIcons.getIconOrNull(`events.${eventId}.${possibilityName}`)
		?? AppIcons.getIconOrNull(`events.${eventId}.${possibilityName}.0`);
}

export function reactionLabel(reaction: ReactionCollectorReaction, data: ReactionCollectorData): string {
	switch (reaction.type) {
		case GENERIC_REACTION_KINDS.ACCEPT:
			if (data.type === ITEM_DATA_KINDS.ACCEPT) {
				return withIcon("collectors.accept", i18n.t("app:collector.choices.replaceItem", {
					item: itemDisplayName(data.data.itemWithDetails)
				}));
			}
			return withIcon("collectors.accept", i18n.t("app:collector.accept"));
		case GENERIC_REACTION_KINDS.REFUSE:
			return withIcon("collectors.refuse", i18n.t("app:collector.refuse"));
		case DRINK_REACTION_KINDS.POTION:
			return `${AppIcons.getIcon(`potions.${reaction.data.potion.id}`)} ${i18n.t(`models:potions.${reaction.data.potion.id}`)}`;
		case BIG_EVENT_REACTION_KINDS.POSSIBILITY: {
			if (data.type !== BIG_EVENT_DATA_KINDS.COLLECTOR) {
				return i18n.t("app:collector.unknownChoice");
			}
			const eventId = data.data.eventId;
			const possibilityName = reaction.data.name;
			const icon = eventReactionIcon(eventId, possibilityName);
			const label = i18n.t(`events:${eventId}.possibilities.${possibilityName}.text`);
			return icon ? `${icon} ${label}` : label;
		}
		case SMALL_EVENT_REACTION_KINDS.ALTAR_CONTRIBUTE:
			return withIcon("altarSmallEvent.contribute", i18n.t("app:collector.choices.altarContribute", {
				amount: reaction.data.amount
			}));
		case SMALL_EVENT_REACTION_KINDS.BAD_PET:
			if (data.type !== SMALL_EVENT_DATA_KINDS.BAD_PET) {
				return i18n.t("app:collector.unknownChoice");
			}
			if (!BAD_PET_ACTION_IDS.has(reaction.data.id)) {
				return i18n.t("app:collector.unknownChoice");
			}
			return withIcon(`badPetSmallEvent.${reaction.data.id}`, i18n.t(badPetActionTranslationKey(reaction.data.id, data.data.sex), {
				context: sexContext(data.data.sex)
			}));
		case SMALL_EVENT_REACTION_KINDS.GOBLETS_GAME:
			if (data.type !== SMALL_EVENT_DATA_KINDS.GOBLETS_GAME || !isKnownGoblet(reaction.data.id, reaction.data.strategy)) {
				return i18n.t("app:collector.unknownChoice");
			}
			return withIcon("smallEvents.gobletsGame", i18n.t(`smallEvents:gobletsGame.goblets.${reaction.data.id}.name`));
		case SMALL_EVENT_REACTION_KINDS.LOTTERY_EASY:
			return withIcon("collectors.lottery.easy", i18n.t("app:collector.choices.lotteryEasy"));
		case SMALL_EVENT_REACTION_KINDS.LOTTERY_MEDIUM:
			return withIcon("collectors.lottery.medium", i18n.t("app:collector.choices.lotteryMedium"));
		case SMALL_EVENT_REACTION_KINDS.LOTTERY_HARD:
			return withIcon("collectors.lottery.hard", i18n.t("app:collector.choices.lotteryHard"));
		case SMALL_EVENT_REACTION_KINDS.PET_FOOD_INVESTIGATE:
			return withIcon("smallEvents.petFood", i18n.t("smallEvents:petFood.choices.investigate"));
		case SMALL_EVENT_REACTION_KINDS.PET_FOOD_SEND_PET:
			return withIcon("smallEvents.petFood", i18n.t("smallEvents:petFood.choices.sendPet"));
		case SMALL_EVENT_REACTION_KINDS.PET_FOOD_CONTINUE:
			return withIcon("smallEvents.petFood", i18n.t("smallEvents:petFood.choices.continue"));
		case SMALL_EVENT_REACTION_KINDS.WITCH:
			if (AppIcons.getIconOrNull(`witchSmallEvent.${reaction.data.id}`) === null) {
				return i18n.t("app:collector.unknownChoice");
			}
			return withIcon(`witchSmallEvent.${reaction.data.id}`, i18n.t(`smallEvents:witch.witchEventNames.${reaction.data.id}`));
		case ITEM_REACTION_KINDS.CHOICE_ITEM:
			if (data.type !== ITEM_DATA_KINDS.CHOICE) {
				return i18n.t("app:collector.unknownChoice");
			}
			return withIcon(itemIconPath(reaction.data.itemWithDetails) ?? "collectors.warning", i18n.t("app:collector.choices.replaceItemInSlot", {
				item: itemDisplayName(reaction.data.itemWithDetails),
				slot: reaction.data.slot
			}));
		case ITEM_REACTION_KINDS.CHOICE_DRINK_POTION:
			return withIcon("collectors.accept", i18n.t("app:collector.choices.drinkPotion"));
		case ITEM_REACTION_KINDS.CHOICE_REFUSE:
			return withIcon("collectors.refuse", i18n.t("app:collector.refuse"));
		case ITEM_REACTION_KINDS.ACCEPT_DRINK_POTION:
			return withIcon("collectors.accept", i18n.t("app:collector.choices.drinkPotion"));
		case "unknown":
			return i18n.t("app:collector.unknownChoice");
		default: {
			const unhandled: never = reaction;
			return unhandled;
		}
	}
}

/**
 * A choice the app does not know how to render yet must not be offered: the player would press a
 * button whose effect is unknown to them.
 */
export function isChoosable(reaction: ReactionCollectorReaction, data?: ReactionCollectorData): boolean {
	if (reaction.type === "unknown") {
		return false;
	}
	if (!data) {
		return true;
	}

	switch (reaction.type) {
		case SMALL_EVENT_REACTION_KINDS.BAD_PET:
			return data.type === SMALL_EVENT_DATA_KINDS.BAD_PET
				&& BAD_PET_ACTION_IDS.has(reaction.data.id);
		case SMALL_EVENT_REACTION_KINDS.GOBLETS_GAME:
			return data.type === SMALL_EVENT_DATA_KINDS.GOBLETS_GAME && isKnownGoblet(reaction.data.id, reaction.data.strategy);
		case SMALL_EVENT_REACTION_KINDS.WITCH:
			return data.type === SMALL_EVENT_DATA_KINDS.WITCH
				&& AppIcons.getIconOrNull(`witchSmallEvent.${reaction.data.id}`) !== null;
		case ITEM_REACTION_KINDS.CHOICE_ITEM:
			return data.type === ITEM_DATA_KINDS.CHOICE
				&& itemTypeFromCategory(reaction.data.itemWithDetails.itemCategory) !== null;
		case ITEM_REACTION_KINDS.CHOICE_DRINK_POTION:
		case ITEM_REACTION_KINDS.CHOICE_REFUSE:
			return data.type === ITEM_DATA_KINDS.CHOICE;
		case ITEM_REACTION_KINDS.ACCEPT_DRINK_POTION:
			return data.type === ITEM_DATA_KINDS.ACCEPT;
		default:
			return true;
	}
}
