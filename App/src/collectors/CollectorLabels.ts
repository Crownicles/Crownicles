import {
	BIG_EVENT_DATA_KINDS, BIG_EVENT_REACTION_KINDS,
	DRINK_DATA_KINDS, DRINK_REACTION_KINDS,
	GENERIC_REACTION_KINDS, REPORT_COLLECTOR_DATA_KINDS, REPORT_COLLECTOR_REACTION_KINDS,
	SMALL_EVENT_DATA_KINDS, SMALL_EVENT_REACTION_KINDS,
	ITEM_DATA_KINDS, ITEM_REACTION_KINDS,
	SMALL_EVENT_BAD_PET_ACTION_IDS, SMALL_EVENT_GOBLET_IDS, SMALL_EVENT_GOBLET_STRATEGIES,
	UNKNOWN_COLLECTOR_KIND, GardenerConditionKey,
	SmallEventBadPetActionId, SmallEventGobletId, SmallEventGobletStrategy,
	ReactionCollectorData, ReactionCollectorReaction
} from "ws-packets/src/fromServer/collectors";
import {Item} from "ws-packets/src/objects/Item";
import {ItemWithDetails} from "ws-packets/src/objects/ItemWithDetails";
import {PetSex} from "ws-packets/src/objects/OwnedPet";
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

const MILLISECONDS_PER_MINUTE = 60_000;


const BAD_PET_ACTIONS_WITH_SEX = new Set<SmallEventBadPetActionId>([
	"intimidate",
	"flee",
	"hide",
	"protect",
	"calm",
	"imposer",
	"energize"
]);

const BAD_PET_ACTION_IDS = new Set<SmallEventBadPetActionId>(Object.values(SMALL_EVENT_BAD_PET_ACTION_IDS));

const GOBLET_STRATEGIES_BY_ID: Record<SmallEventGobletId, SmallEventGobletStrategy> = {
	[SMALL_EVENT_GOBLET_IDS.METAL]: SMALL_EVENT_GOBLET_STRATEGIES.CLASSIC,
	[SMALL_EVENT_GOBLET_IDS.BIGGEST]: SMALL_EVENT_GOBLET_STRATEGIES.SAFE,
	[SMALL_EVENT_GOBLET_IDS.SPARKLING]: SMALL_EVENT_GOBLET_STRATEGIES.RISKY,
	[SMALL_EVENT_GOBLET_IDS.CRACKED]: SMALL_EVENT_GOBLET_STRATEGIES.GAMBLER
};

const GARDENER_REWARD_CONDITION_KEYS = new Set<GardenerConditionKey>([
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

function sexContext(sex: PetSex): string {
	return sex === "f" ? SEX_CONTEXTS.FEMALE : SEX_CONTEXTS.MALE;
}

function withIcon(iconPath: string, label: string): string {
	const icon = AppIcons.getIconOrNull(iconPath);
	return icon ? `${icon} ${label}` : label;
}

function smallEventTitle(titleKey: string, iconPath: string): string {
	return withIcon(iconPath, i18n.t(titleKey));
}

function badPetActionTranslationKey(actionId: SmallEventBadPetActionId, sex: PetSex): string {
	const suffix = BAD_PET_ACTIONS_WITH_SEX.has(actionId) ? `_${sexContext(sex)}` : "";
	return `smallEvents:badPet.choices.${actionId}${suffix}`;
}

function badPetDisplayName(petId: number, petNickname: string | undefined, sex: PetSex): string {
	return petNickname ?? i18n.t(`models:pets:${petId}`, { context: sexContext(sex) });
}

function isKnownGoblet(id: SmallEventGobletId | undefined, strategy?: SmallEventGobletStrategy): boolean {
	if (id === undefined || !Object.hasOwn(GOBLET_STRATEGIES_BY_ID, id)) {
		return false;
	}
	return strategy === undefined || GOBLET_STRATEGIES_BY_ID[id] === strategy;
}

function gardenerRewardConditionKey(conditionKey: GardenerConditionKey): string {
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

function itemDisplayName(item: Item | ItemWithDetails): string {
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

function destinationDuration(tripDuration: number | undefined): string {
	if (tripDuration === undefined) {
		return i18n.t("app:collector.descriptions.unknownDuration");
	}
	const minutes = Math.max(0, Math.ceil(tripDuration / MILLISECONDS_PER_MINUTE));
	const hours = Math.floor(minutes / 60);
	return hours > 0
		? i18n.t("app:adventure.duration.hoursMinutes", {hours, minutes: minutes % 60})
		: i18n.t("app:adventure.duration.minutes", {minutes});
}

function eventReactionIcon(eventId: number, possibilityName: string): string | null {
	return AppIcons.getIconOrNull(`events.${eventId}.${possibilityName}`)
		?? AppIcons.getIconOrNull(`events.${eventId}.${possibilityName}.0`);
}

type DataHandler = (data: ReactionCollectorData) => string | undefined;
type ReactionHandler = (reaction: ReactionCollectorReaction, data: ReactionCollectorData) => string;
type ChoosableHandler = (reaction: ReactionCollectorReaction, data?: ReactionCollectorData) => boolean;

function isDataOfType<Kind extends ReactionCollectorData["type"]>(
	data: ReactionCollectorData | undefined,
	kind: Kind
): data is Extract<ReactionCollectorData, { type: Kind }> {
	return data?.type === kind;
}

function isReactionOfType<Kind extends ReactionCollectorReaction["type"]>(
	reaction: ReactionCollectorReaction,
	kind: Kind
): reaction is Extract<ReactionCollectorReaction, { type: Kind }> {
	return reaction.type === kind;
}

function makeDataHandler<Kind extends ReactionCollectorData["type"]>(
	kind: Kind,
	handler: (data: Extract<ReactionCollectorData, { type: Kind }>) => string | undefined
): DataHandler {
	return data => isDataOfType(data, kind) ? handler(data) : undefined;
}

function makeReactionHandler<Kind extends ReactionCollectorReaction["type"]>(
	kind: Kind,
	handler: (reaction: Extract<ReactionCollectorReaction, { type: Kind }>, data: ReactionCollectorData) => string
): ReactionHandler {
	return (reaction, data) => isReactionOfType(reaction, kind)
		? handler(reaction, data)
		: i18n.t("app:collector.unknownChoice");
}

function makeChoosableHandler<Kind extends ReactionCollectorReaction["type"]>(
	kind: Kind,
	handler: (reaction: Extract<ReactionCollectorReaction, { type: Kind }>, data?: ReactionCollectorData) => boolean
): ChoosableHandler {
	return (reaction, data) => isReactionOfType(reaction, kind) && handler(reaction, data);
}

const COLLECTOR_TITLE_HANDLERS: Record<ReactionCollectorData["type"], () => string> = {
	[DRINK_DATA_KINDS.COLLECTOR]: () => i18n.t("app:collector.titles.drink"),
	[BIG_EVENT_DATA_KINDS.COLLECTOR]: () => i18n.t("app:collector.titles.bigEvent"),
	[SMALL_EVENT_DATA_KINDS.ALTAR]: () => smallEventTitle("app:collector.titles.altar", "smallEvents.altar"),
	[SMALL_EVENT_DATA_KINDS.BAD_PET]: () => smallEventTitle("app:collector.titles.badPet", "smallEvents.badPet"),
	[SMALL_EVENT_DATA_KINDS.GARDENER]: () => smallEventTitle("app:collector.titles.gardener", "smallEvents.gardener"),
	[SMALL_EVENT_DATA_KINDS.GOBLETS_GAME]: () => smallEventTitle("app:collector.titles.gobletsGame", "smallEvents.gobletsGame"),
	[SMALL_EVENT_DATA_KINDS.INTERACT_OTHER_PLAYERS]: () => smallEventTitle("app:collector.titles.interactOtherPlayers", "smallEvents.interactOtherPlayers"),
	[SMALL_EVENT_DATA_KINDS.LIMOGES]: () => smallEventTitle("app:collector.titles.limoges", "smallEvents.limoges"),
	[SMALL_EVENT_DATA_KINDS.LOTTERY]: () => smallEventTitle("app:collector.titles.lottery", "smallEvents.lottery"),
	[SMALL_EVENT_DATA_KINDS.PET_FOOD]: () => smallEventTitle("app:collector.titles.petFood", "smallEvents.petFood"),
	[SMALL_EVENT_DATA_KINDS.WITCH]: () => smallEventTitle("app:collector.titles.witch", "smallEvents.witch"),
	[ITEM_DATA_KINDS.CHOICE]: () => smallEventTitle("app:collector.titles.itemChoice", "collectors.warning"),
	[ITEM_DATA_KINDS.ACCEPT]: () => smallEventTitle("app:collector.titles.itemAccept", "collectors.warning"),
	[REPORT_COLLECTOR_DATA_KINDS.DESTINATION]: () => i18n.t("app:collector.titles.destination"),
	[UNKNOWN_COLLECTOR_KIND]: () => i18n.t("app:collector.titles.unknown")
};

const COLLECTOR_DESCRIPTION_HANDLERS: Record<ReactionCollectorData["type"], DataHandler> = {
	[BIG_EVENT_DATA_KINDS.COLLECTOR]: makeDataHandler(BIG_EVENT_DATA_KINDS.COLLECTOR, data => i18n.t(`events:${data.data.eventId}.text`)),
	[DRINK_DATA_KINDS.COLLECTOR]: () => undefined,
	[SMALL_EVENT_DATA_KINDS.ALTAR]: makeDataHandler(SMALL_EVENT_DATA_KINDS.ALTAR, data => i18n.t("smallEvents:altar.intro.0", {
		poolAmount: data.data.poolAmount,
		poolThreshold: data.data.poolThreshold,
		moneyEmote: AppIcons.getIcon("unitValues.money")
	})),
	[SMALL_EVENT_DATA_KINDS.BAD_PET]: makeDataHandler(SMALL_EVENT_DATA_KINDS.BAD_PET, data => i18n.t("smallEvents:badPet.intro", {
		context: sexContext(data.data.sex),
		pet: badPetDisplayName(data.data.petId, data.data.petNickname, data.data.sex)
	})),
	[SMALL_EVENT_DATA_KINDS.GARDENER]: makeDataHandler(SMALL_EVENT_DATA_KINDS.GARDENER, data => `${i18n.t(`smallEvents:gardener.stories.${data.data.isFirstEncounter === true ? "first" : "recurring"}.0`)} ${i18n.t(`smallEvents:gardener.rewards.seed.${gardenerRewardConditionKey(data.data.conditionKey)}.0`, {
		cost: data.data.cost
	})} ${i18n.t("app:collector.descriptions.gardenerSeed", {
		seed: gardenerSeedDisplay(data.data.seedId)
	})}`),
	[SMALL_EVENT_DATA_KINDS.GOBLETS_GAME]: () => i18n.t("smallEvents:gobletsGame.intro.0"),
	[SMALL_EVENT_DATA_KINDS.INTERACT_OTHER_PLAYERS]: makeDataHandler(SMALL_EVENT_DATA_KINDS.INTERACT_OTHER_PLAYERS, data => interactOtherPlayersDescription(data.data.keycloakId, data.data.rank)),
	[SMALL_EVENT_DATA_KINDS.LIMOGES]: makeDataHandler(SMALL_EVENT_DATA_KINDS.LIMOGES, data => i18n.t(`smallEvents:limoges.questions.${data.data.questionId}`)),
	[SMALL_EVENT_DATA_KINDS.LOTTERY]: () => i18n.t("smallEvents:lottery.intro"),
	[SMALL_EVENT_DATA_KINDS.PET_FOOD]: makeDataHandler(SMALL_EVENT_DATA_KINDS.PET_FOOD, data => i18n.t(`smallEvents:petFood.intro.${data.data.foodType}_${data.data.petSex === "f" ? "female" : "male"}`)),
	[SMALL_EVENT_DATA_KINDS.WITCH]: () => `${i18n.t("smallEvents:witch.intro.0")}${i18n.t("smallEvents:witch.description.0")}${i18n.t("smallEvents:witch.situation.0")}`,
	[ITEM_DATA_KINDS.CHOICE]: makeDataHandler(ITEM_DATA_KINDS.CHOICE, data => i18n.t("app:collector.descriptions.itemChoice", {
		item: itemDisplayName(data.data.item)
	})),
	[ITEM_DATA_KINDS.ACCEPT]: makeDataHandler(ITEM_DATA_KINDS.ACCEPT, data => i18n.t("app:collector.descriptions.itemAccept", {
		item: itemDisplayName(data.data.itemWithDetails)
	})),
	[REPORT_COLLECTOR_DATA_KINDS.DESTINATION]: () => i18n.t("app:collector.descriptions.destination"),
	[UNKNOWN_COLLECTOR_KIND]: () => undefined
};

const REACTION_LABEL_HANDLERS: Record<ReactionCollectorReaction["type"], ReactionHandler> = {
	[GENERIC_REACTION_KINDS.ACCEPT]: (_reaction, data) => data.type === ITEM_DATA_KINDS.ACCEPT
		? withIcon("collectors.accept", i18n.t("app:collector.choices.replaceItem", {
			item: itemDisplayName(data.data.itemWithDetails)
		}))
		: withIcon("collectors.accept", i18n.t("app:collector.accept")),
	[GENERIC_REACTION_KINDS.REFUSE]: () => withIcon("collectors.refuse", i18n.t("app:collector.refuse")),
	[DRINK_REACTION_KINDS.POTION]: makeReactionHandler(DRINK_REACTION_KINDS.POTION, reaction => `${AppIcons.getIcon(`potions.${reaction.data.potion.id}`)} ${i18n.t(`models:potions.${reaction.data.potion.id}`)}`),
	[BIG_EVENT_REACTION_KINDS.POSSIBILITY]: makeReactionHandler(BIG_EVENT_REACTION_KINDS.POSSIBILITY, (reaction, data) => {
		if (!isDataOfType(data, BIG_EVENT_DATA_KINDS.COLLECTOR)) {
			return i18n.t("app:collector.unknownChoice");
		}
		const icon = eventReactionIcon(data.data.eventId, reaction.data.name);
		const label = i18n.t(`events:${data.data.eventId}.possibilities.${reaction.data.name}.text`);
		return icon ? `${icon} ${label}` : label;
	}),
	[SMALL_EVENT_REACTION_KINDS.ALTAR_CONTRIBUTE]: makeReactionHandler(SMALL_EVENT_REACTION_KINDS.ALTAR_CONTRIBUTE, reaction => withIcon("altarSmallEvent.contribute", i18n.t("app:collector.choices.altarContribute", {
		amount: reaction.data.amount
	}))),
	[SMALL_EVENT_REACTION_KINDS.BAD_PET]: makeReactionHandler(SMALL_EVENT_REACTION_KINDS.BAD_PET, (reaction, data) => {
		if (!isDataOfType(data, SMALL_EVENT_DATA_KINDS.BAD_PET) || !BAD_PET_ACTION_IDS.has(reaction.data.id)) {
			return i18n.t("app:collector.unknownChoice");
		}
		return withIcon(`badPetSmallEvent.${reaction.data.id}`, i18n.t(badPetActionTranslationKey(reaction.data.id, data.data.sex), {
			context: sexContext(data.data.sex)
		}));
	}),
	[SMALL_EVENT_REACTION_KINDS.GOBLETS_GAME]: makeReactionHandler(SMALL_EVENT_REACTION_KINDS.GOBLETS_GAME, (reaction, data) => {
		if (!isDataOfType(data, SMALL_EVENT_DATA_KINDS.GOBLETS_GAME) || !isKnownGoblet(reaction.data.id, reaction.data.strategy)) {
			return i18n.t("app:collector.unknownChoice");
		}
		return withIcon("smallEvents.gobletsGame", i18n.t(`smallEvents:gobletsGame.goblets.${reaction.data.id}.name`));
	}),
	[SMALL_EVENT_REACTION_KINDS.LOTTERY_EASY]: () => withIcon("collectors.lottery.easy", i18n.t("app:collector.choices.lotteryEasy")),
	[SMALL_EVENT_REACTION_KINDS.LOTTERY_MEDIUM]: () => withIcon("collectors.lottery.medium", i18n.t("app:collector.choices.lotteryMedium")),
	[SMALL_EVENT_REACTION_KINDS.LOTTERY_HARD]: () => withIcon("collectors.lottery.hard", i18n.t("app:collector.choices.lotteryHard")),
	[SMALL_EVENT_REACTION_KINDS.PET_FOOD_INVESTIGATE]: () => withIcon("smallEvents.petFood", i18n.t("smallEvents:petFood.choices.investigate")),
	[SMALL_EVENT_REACTION_KINDS.PET_FOOD_SEND_PET]: () => withIcon("smallEvents.petFood", i18n.t("smallEvents:petFood.choices.sendPet")),
	[SMALL_EVENT_REACTION_KINDS.PET_FOOD_CONTINUE]: () => withIcon("smallEvents.petFood", i18n.t("smallEvents:petFood.choices.continue")),
	[SMALL_EVENT_REACTION_KINDS.WITCH]: makeReactionHandler(SMALL_EVENT_REACTION_KINDS.WITCH, reaction => {
		if (AppIcons.getIconOrNull(`witchSmallEvent.${reaction.data.id}`) === null) {
			return i18n.t("app:collector.unknownChoice");
		}
		return withIcon(`witchSmallEvent.${reaction.data.id}`, i18n.t(`smallEvents:witch.witchEventNames.${reaction.data.id}`));
	}),
	[ITEM_REACTION_KINDS.CHOICE_ITEM]: makeReactionHandler(ITEM_REACTION_KINDS.CHOICE_ITEM, (reaction, data) => {
		if (!isDataOfType(data, ITEM_DATA_KINDS.CHOICE)) {
			return i18n.t("app:collector.unknownChoice");
		}
		return withIcon(itemIconPath(reaction.data.itemWithDetails) ?? "collectors.warning", i18n.t("app:collector.choices.replaceItemInSlot", {
			item: itemDisplayName(reaction.data.itemWithDetails),
			slot: reaction.data.slot
		}));
	}),
	[ITEM_REACTION_KINDS.CHOICE_DRINK_POTION]: () => withIcon("collectors.accept", i18n.t("app:collector.choices.drinkPotion")),
	[ITEM_REACTION_KINDS.CHOICE_REFUSE]: () => withIcon("collectors.refuse", i18n.t("app:collector.refuse")),
	[ITEM_REACTION_KINDS.ACCEPT_DRINK_POTION]: () => withIcon("collectors.accept", i18n.t("app:collector.choices.drinkPotion")),
	[REPORT_COLLECTOR_REACTION_KINDS.DESTINATION]: makeReactionHandler(REPORT_COLLECTOR_REACTION_KINDS.DESTINATION, reaction => {
		const icon = AppIcons.getIconOrNull(`mapTypes.${reaction.data.mapTypeId}`);
		const destination = i18n.t(`models:map_locations.${reaction.data.mapId}.name`);
		return i18n.t("app:collector.choices.destination", {
			destination: icon ? `${icon} ${destination}` : destination,
			duration: destinationDuration(reaction.data.tripDuration)
		});
	}),
	[REPORT_COLLECTOR_REACTION_KINDS.STAY_IN_CITY]: () => withIcon("other.stay", i18n.t("app:collector.choices.stayInCity")),
	[UNKNOWN_COLLECTOR_KIND]: () => i18n.t("app:collector.unknownChoice")
};

const CHOOSABLE_HANDLERS: Record<ReactionCollectorReaction["type"], ChoosableHandler> = {
	[GENERIC_REACTION_KINDS.ACCEPT]: () => true,
	[GENERIC_REACTION_KINDS.REFUSE]: () => true,
	[DRINK_REACTION_KINDS.POTION]: () => true,
	[BIG_EVENT_REACTION_KINDS.POSSIBILITY]: makeChoosableHandler(BIG_EVENT_REACTION_KINDS.POSSIBILITY, (_reaction, data) => isDataOfType(data, BIG_EVENT_DATA_KINDS.COLLECTOR)),
	[SMALL_EVENT_REACTION_KINDS.ALTAR_CONTRIBUTE]: () => true,
	[SMALL_EVENT_REACTION_KINDS.BAD_PET]: makeChoosableHandler(SMALL_EVENT_REACTION_KINDS.BAD_PET, reaction => BAD_PET_ACTION_IDS.has(reaction.data.id)),
	[SMALL_EVENT_REACTION_KINDS.GOBLETS_GAME]: makeChoosableHandler(SMALL_EVENT_REACTION_KINDS.GOBLETS_GAME, (reaction, data) => isDataOfType(data, SMALL_EVENT_DATA_KINDS.GOBLETS_GAME)
		&& isKnownGoblet(reaction.data.id, reaction.data.strategy)),
	[SMALL_EVENT_REACTION_KINDS.LOTTERY_EASY]: () => true,
	[SMALL_EVENT_REACTION_KINDS.LOTTERY_MEDIUM]: () => true,
	[SMALL_EVENT_REACTION_KINDS.LOTTERY_HARD]: () => true,
	[SMALL_EVENT_REACTION_KINDS.PET_FOOD_INVESTIGATE]: () => true,
	[SMALL_EVENT_REACTION_KINDS.PET_FOOD_SEND_PET]: () => true,
	[SMALL_EVENT_REACTION_KINDS.PET_FOOD_CONTINUE]: () => true,
	[SMALL_EVENT_REACTION_KINDS.WITCH]: makeChoosableHandler(SMALL_EVENT_REACTION_KINDS.WITCH, (reaction, data) => isDataOfType(data, SMALL_EVENT_DATA_KINDS.WITCH)
		&& AppIcons.getIconOrNull(`witchSmallEvent.${reaction.data.id}`) !== null),
	[ITEM_REACTION_KINDS.CHOICE_ITEM]: makeChoosableHandler(ITEM_REACTION_KINDS.CHOICE_ITEM, (reaction, data) => isDataOfType(data, ITEM_DATA_KINDS.CHOICE)
		&& itemTypeFromCategory(reaction.data.itemWithDetails.itemCategory) !== null),
	[ITEM_REACTION_KINDS.CHOICE_DRINK_POTION]: makeChoosableHandler(ITEM_REACTION_KINDS.CHOICE_DRINK_POTION, (_reaction, data) => isDataOfType(data, ITEM_DATA_KINDS.CHOICE)),
	[ITEM_REACTION_KINDS.CHOICE_REFUSE]: makeChoosableHandler(ITEM_REACTION_KINDS.CHOICE_REFUSE, (_reaction, data) => isDataOfType(data, ITEM_DATA_KINDS.CHOICE)),
	[ITEM_REACTION_KINDS.ACCEPT_DRINK_POTION]: makeChoosableHandler(ITEM_REACTION_KINDS.ACCEPT_DRINK_POTION, (_reaction, data) => isDataOfType(data, ITEM_DATA_KINDS.ACCEPT)),
	[REPORT_COLLECTOR_REACTION_KINDS.DESTINATION]: makeChoosableHandler(REPORT_COLLECTOR_REACTION_KINDS.DESTINATION, (_reaction, data) => isDataOfType(data, REPORT_COLLECTOR_DATA_KINDS.DESTINATION)),
	[REPORT_COLLECTOR_REACTION_KINDS.STAY_IN_CITY]: makeChoosableHandler(REPORT_COLLECTOR_REACTION_KINDS.STAY_IN_CITY, (_reaction, data) => isDataOfType(data, REPORT_COLLECTOR_DATA_KINDS.DESTINATION)),
	[UNKNOWN_COLLECTOR_KIND]: () => false
};

/**
 * Turns the protocol kinds into what the player reads. The records above are exhaustive, so adding
 * a collector family without giving it a wording breaks the build here.
 */
export function collectorTitle(data: ReactionCollectorData): string {
	return COLLECTOR_TITLE_HANDLERS[data.type]();
}

export function collectorDescription(data: ReactionCollectorData): string | undefined {
	return COLLECTOR_DESCRIPTION_HANDLERS[data.type](data);
}

export function reactionLabel(reaction: ReactionCollectorReaction, data: ReactionCollectorData): string {
	return REACTION_LABEL_HANDLERS[reaction.type](reaction, data);
}

/**
 * A choice the app does not know how to render yet must not be offered: the player would press a
 * button whose effect is unknown to them.
 */
export function isChoosable(reaction: ReactionCollectorReaction, data?: ReactionCollectorData): boolean {
	return CHOOSABLE_HANDLERS[reaction.type](reaction, data);
}
