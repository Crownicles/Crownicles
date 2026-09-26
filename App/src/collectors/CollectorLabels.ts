import {
	BIG_EVENT_DATA_KINDS, BIG_EVENT_REACTION_KINDS,
	DRINK_DATA_KINDS, DRINK_REACTION_KINDS,
	EQUIP_DATA_KINDS, EQUIP_REACTION_KINDS,
	SELL_DATA_KINDS, SELL_REACTION_KINDS,
	DAILY_BONUS_DATA_KINDS, DAILY_BONUS_REACTION_KINDS,
	CLASSES_DATA_KINDS, CLASSES_REACTION_KINDS,
	PET_FEED_DATA_KINDS, PET_FEED_REACTION_KINDS,
	EXPEDITION_DATA_KINDS, EXPEDITION_REACTION_KINDS,
	PET_MANAGEMENT_DATA_KINDS, PET_MANAGEMENT_REACTION_KINDS,
	GUILD_DATA_KINDS,
	FIGHT_DATA_KINDS, FIGHT_REACTION_KINDS,
	PLAYER_UTILITY_DATA_KINDS,
	GENERIC_REACTION_KINDS, REPORT_COLLECTOR_DATA_KINDS, REPORT_COLLECTOR_REACTION_KINDS,
	SMALL_EVENT_DATA_KINDS, SMALL_EVENT_REACTION_KINDS,
	ITEM_DATA_KINDS, ITEM_REACTION_KINDS,
	CITY_DATA_KINDS, CITY_REACTION_KINDS,
	SHOP_DATA_KINDS, SHOP_REACTION_KINDS,
	SMALL_EVENT_BAD_PET_ACTION_IDS, SMALL_EVENT_GOBLET_IDS, SMALL_EVENT_GOBLET_STRATEGIES,
	UNKNOWN_COLLECTOR_KIND,
	SmallEventBadPetActionId, SmallEventGobletId, SmallEventGobletStrategy,
	ReactionCollectorData, ReactionCollectorDataOf, ReactionCollectorReaction
} from "ws-packets/src/fromServer/collectors";
import {Item} from "ws-packets/src/objects/Item";
import {ItemWithDetails} from "ws-packets/src/objects/ItemWithDetails";
import {PetSex} from "ws-packets/src/objects/OwnedPet";
import {i18n} from "@/src/translations/i18n";
import {joinParagraphs} from "@/src/display/Paragraphs";
import {formatDurationMinutes} from "@/src/display/ItemEffects";
import {randomTranslation} from "@/src/translations/RandomTranslation";
import {AppIcons} from "@/src/AppIcons";
import {shopItemName} from "@/src/collectors/ShopLabels";
import {plainStory} from "@/src/display/Markdown";
import {missionDescription} from "@/src/display/Missions";
import {petName, petShortField} from "@/src/display/PetDisplay";
import {fightActionName} from "@/src/display/Fight";

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

type ShelterPetSelection = Extract<ReactionCollectorReaction, {data: {petEntityId: number}}>;

function shelterPetLabel(reaction: ShelterPetSelection, data: ReactionCollectorData): string {
	if (data.type !== PET_MANAGEMENT_DATA_KINDS.TRANSFER && data.type !== PET_MANAGEMENT_DATA_KINDS.FREE_SELECT) return i18n.t("app:collector.unknownChoice");
	const pet = data.data.shelterPets.find(entry => entry.petEntityId === reaction.data.petEntityId)?.pet ?? data.data.ownPet;
	return pet ? petName(pet) : i18n.t("app:collector.unknownChoice");
}

function cityServiceLabel(service: string): string {
	return i18n.t(`commands:report.city.shops.${service}.label`);
}

function cityReactionLabel(reaction: string): string {
	return i18n.t(`app:city.reactions.${reaction}`);
}

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

function isKnownGoblet(id: SmallEventGobletId | undefined, strategy?: SmallEventGobletStrategy): boolean {
	if (id === undefined || !Object.hasOwn(GOBLET_STRATEGIES_BY_ID, id)) {
		return false;
	}
	return strategy === undefined || GOBLET_STRATEGIES_BY_ID[id] === strategy;
}

/** Discord opens most small events with a travel line; the offer seeds the pick so the prompt does not change as it re-renders. */
function promptIntro(data: ReactionCollectorData): string {
	return randomTranslation("smallEvents:intro", {offer: JSON.stringify(data.data)});
}

function fightPetPrompt(collector: ReactionCollectorDataOf<typeof SMALL_EVENT_DATA_KINDS.FIGHT_PET>): string {
	const {petId, isFemale} = collector.data;
	const context = isFemale ? SEX_CONTEXTS.FEMALE : SEX_CONTEXTS.MALE;
	const feralPet = i18n.t("smallEvents:fightPet.customPetDisplay", {
		context,
		petId,
		petName: i18n.t(`models:pets.${petId}`, {context}),
		adjective: randomTranslation("smallEvents:fightPet.adjectives", {context, petId})
	});
	return `${promptIntro(collector)}${randomTranslation("smallEvents:fightPet.intro", {context, feralPet})} ${randomTranslation("smallEvents:fightPet.situation", {petId})}`;
}

function itemTypeFromCategory(category: number): typeof ITEM_TYPES_BY_CATEGORY[number] | null {
	return ITEM_TYPES_BY_CATEGORY[category] ?? null;
}

export function isPotionCategory(category: number): boolean {
	return itemTypeFromCategory(category) === "potion";
}

export function itemCategoryLabel(category: number): string {
	const type = itemTypeFromCategory(category);
	return type ? i18n.t(`items:${type}`, {count: 1}) : i18n.t("app:collector.descriptions.unknownItem");
}

export function itemDisplayName(item: Item | ItemWithDetails): string {
	const category = "category" in item ? item.category : item.itemCategory;
	const itemType = itemTypeFromCategory(category);
	return itemType
		? i18n.t(`models:${itemType}s.${item.id}`)
		: i18n.t("app:collector.descriptions.unknownItem");
}

export function itemIconPath(item: ItemWithDetails): string | null {
	const itemType = itemTypeFromCategory(item.itemCategory);
	return itemType ? `${itemType}s.${item.id}` : null;
}

/** An item on sale and what it costs, as the wandering and the epic merchants offer it. */
type ShopOffer = {item: ItemWithDetails; price: number};

function shopEnd({item, price}: ShopOffer): string {
	const iconPath = itemIconPath(item);
	return randomTranslation("smallEvents:shop.end", {
		item: `${iconPath ? AppIcons.getIconOrNull(iconPath) ?? "" : ""} ${itemDisplayName(item)}`,
		price,
		type: `${AppIcons.getIconOrNull(`itemCategories.${item.itemCategory}`) ?? ""}${i18n.tArray("smallEvents:shop.types")[item.itemCategory] ?? ""}`
	});
}

/** The wandering merchant is a man or a woman, drawn once per offer like Discord draws it once per message. */
function shopPrompt(offer: ShopOffer): string {
	const context = (offer.item.id + offer.price) % 2 === 0 ? "m" : "f";
	const name = randomTranslation("smallEvents:shop.names", {context, price: offer.price});
	return randomTranslation("smallEvents:shop.intro", {context, name}) + shopEnd(offer);
}

function destinationDuration(tripDurationMinutes: number | undefined): string {
	if (tripDurationMinutes === undefined) {
		return i18n.t("app:collector.descriptions.unknownDuration");
	}
	return formatDurationMinutes(tripDurationMinutes);
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
	[PLAYER_UTILITY_DATA_KINDS.UNLOCK]: () => i18n.t("app:utilities.unlock"),
	[PLAYER_UTILITY_DATA_KINDS.BOAT]: () => i18n.t("app:utilities.boat"),
	[FIGHT_DATA_KINDS.CONFIRM]: () => i18n.t("app:arena.confirm"),
	[FIGHT_DATA_KINDS.ACTION]: () => i18n.t("app:arena.action"),
	[GUILD_DATA_KINDS.INVITE]: () => i18n.t("app:guild.invitation"),
	[GUILD_DATA_KINDS.MEMBER]: () => i18n.t("app:guild.members"),
	[GUILD_DATA_KINDS.DESCRIPTION]: () => i18n.t("app:guild.confirmDescription"),
	[GUILD_DATA_KINDS.LEAVE]: () => i18n.t("app:guild.leave"),
	[GUILD_DATA_KINDS.CREATE]: () => i18n.t("app:guild.create"),
	[PET_MANAGEMENT_DATA_KINDS.TRANSFER]: () => i18n.t("app:pet.management.transfer"),
	[PET_MANAGEMENT_DATA_KINDS.FREE_SELECT]: () => i18n.t("app:pet.management.free"),
	[PET_MANAGEMENT_DATA_KINDS.FREE_CONFIRM]: () => i18n.t("app:pet.management.free"),
	[PET_MANAGEMENT_DATA_KINDS.SELL]: () => i18n.t("app:pet.sale.title"),
	[GUILD_DATA_KINDS.REIMBURSE]: () => i18n.t("app:guildDomain.reimburse"),
	[EXPEDITION_DATA_KINDS.CHOICE]: () => i18n.t("app:expedition.titles.expeditionChoice"),
	[EXPEDITION_DATA_KINDS.PROGRESS]: () => i18n.t("app:expedition.titles.expeditionProgress"),
	[EXPEDITION_DATA_KINDS.FINISHED]: () => i18n.t("app:expedition.titles.expeditionFinished"),
	[PET_FEED_DATA_KINDS.GUILD]: () => i18n.t("app:pet.care.feed"),
	[PET_FEED_DATA_KINDS.PERSONAL]: () => i18n.t("app:pet.care.feed"),
	[CLASSES_DATA_KINDS.COLLECTOR]: () => i18n.t("app:classes.change"),
	[DAILY_BONUS_DATA_KINDS.COLLECTOR]: () => i18n.t("app:dailyBonus.title"),
	[SELL_DATA_KINDS.COLLECTOR]: () => i18n.t("app:sale.title"),
	[EQUIP_DATA_KINDS.COLLECTOR]: () => i18n.t("app:equipment.title"),
	[DRINK_DATA_KINDS.COLLECTOR]: () => i18n.t("app:collector.titles.drink"),
	[BIG_EVENT_DATA_KINDS.COLLECTOR]: () => i18n.t("app:collector.titles.bigEvent"),
	[SMALL_EVENT_DATA_KINDS.ALTAR]: () => smallEventTitle("app:collector.titles.altar", "smallEvents.altar"),
	[SMALL_EVENT_DATA_KINDS.BAD_PET]: () => smallEventTitle("app:collector.titles.badPet", "smallEvents.badPet"),
	[SMALL_EVENT_DATA_KINDS.CART]: () => smallEventTitle("app:collector.titles.cart", "smallEvents.cart"),
	[SMALL_EVENT_DATA_KINDS.FIGHT_PET]: () => smallEventTitle("app:collector.titles.fightPet", "smallEvents.fightPet"),
	[SMALL_EVENT_DATA_KINDS.GARDENER]: () => smallEventTitle("app:collector.titles.gardener", "smallEvents.gardener"),
	[SMALL_EVENT_DATA_KINDS.GOBLETS_GAME]: () => smallEventTitle("app:collector.titles.gobletsGame", "smallEvents.gobletsGame"),
	[SMALL_EVENT_DATA_KINDS.INTERACT_OTHER_PLAYERS]: () => smallEventTitle("app:collector.titles.interactOtherPlayers", "smallEvents.interactOtherPlayers"),
	[SMALL_EVENT_DATA_KINDS.LIMOGES]: () => smallEventTitle("app:collector.titles.limoges", "smallEvents.limoges"),
	[SMALL_EVENT_DATA_KINDS.LOTTERY]: () => smallEventTitle("app:collector.titles.lottery", "smallEvents.lottery"),
	[SMALL_EVENT_DATA_KINDS.PET_FOOD]: () => smallEventTitle("app:collector.titles.petFood", "smallEvents.petFood"),
	[SMALL_EVENT_DATA_KINDS.PVE_ISLAND]: () => smallEventTitle("app:collector.pveIsland.title", "smallEvents.goToPVEIsland"),
	[SMALL_EVENT_DATA_KINDS.SHOP]: () => smallEventTitle("app:collector.titles.shopSmallEvent", "smallEvents.shop"),
	[SMALL_EVENT_DATA_KINDS.EPIC_SHOP]: () => smallEventTitle("app:collector.titles.epicShopSmallEvent", "smallEvents.epicItemShop"),
	[SMALL_EVENT_DATA_KINDS.RECIPE_SHOP]: () => smallEventTitle("app:collector.titles.recipeShopSmallEvent", "smallEvents.recipeShop"),
	[SMALL_EVENT_DATA_KINDS.WITCH]: () => smallEventTitle("app:collector.titles.witch", "smallEvents.witch"),
	[ITEM_DATA_KINDS.CHOICE]: () => smallEventTitle("app:collector.titles.itemChoice", "collectors.warning"),
	[ITEM_DATA_KINDS.ACCEPT]: () => smallEventTitle("app:collector.titles.itemAccept", "collectors.warning"),
	[REPORT_COLLECTOR_DATA_KINDS.DESTINATION]: () => i18n.t("app:collector.titles.destination"),
	[REPORT_COLLECTOR_DATA_KINDS.USE_TOKENS]: () => i18n.t("app:adventure.tokens.use.title"),
	[REPORT_COLLECTOR_DATA_KINDS.BUY_HEAL]: () => i18n.t("app:adventure.heal.use.title"),
	[REPORT_COLLECTOR_DATA_KINDS.TOKEN_MERCHANT]: () => i18n.t("app:adventure.tokens.merchant.title"),
	[CITY_DATA_KINDS.CITY]: () => i18n.t("app:collector.titles.city"),
	[SHOP_DATA_KINDS.COLLECTOR]: () => i18n.t("app:city.shop.title"),
	[SHOP_DATA_KINDS.SKIP_MISSION]: () => plainStory(i18n.t("commands:shop.shopItems.skipMission.name")),
	[SHOP_DATA_KINDS.BUY_SLOT]: () => plainStory(i18n.t("commands:shop.shopItems.slotExtension.name")),
	[UNKNOWN_COLLECTOR_KIND]: () => i18n.t("app:collector.titles.unknown")
};

const COLLECTOR_DESCRIPTION_HANDLERS: Record<ReactionCollectorData["type"], DataHandler> = {
	[PLAYER_UTILITY_DATA_KINDS.UNLOCK]: () => undefined,
	[PLAYER_UTILITY_DATA_KINDS.BOAT]: () => undefined,
	[FIGHT_DATA_KINDS.CONFIRM]: () => undefined,
	[FIGHT_DATA_KINDS.ACTION]: () => undefined,
	[GUILD_DATA_KINDS.INVITE]: () => undefined,
	[GUILD_DATA_KINDS.MEMBER]: () => undefined,
	[GUILD_DATA_KINDS.DESCRIPTION]: () => undefined,
	[GUILD_DATA_KINDS.LEAVE]: () => undefined,
	[GUILD_DATA_KINDS.CREATE]: () => undefined,
	[PET_MANAGEMENT_DATA_KINDS.TRANSFER]: () => undefined,
	[PET_MANAGEMENT_DATA_KINDS.FREE_SELECT]: () => undefined,
	[PET_MANAGEMENT_DATA_KINDS.FREE_CONFIRM]: () => undefined,
	[PET_MANAGEMENT_DATA_KINDS.SELL]: () => undefined,
	[GUILD_DATA_KINDS.REIMBURSE]: () => undefined,
	[EXPEDITION_DATA_KINDS.CHOICE]: () => undefined,
	[EXPEDITION_DATA_KINDS.PROGRESS]: () => undefined,
	[EXPEDITION_DATA_KINDS.FINISHED]: () => undefined,
	[PET_FEED_DATA_KINDS.GUILD]: () => undefined,
	[PET_FEED_DATA_KINDS.PERSONAL]: () => undefined,
	[CLASSES_DATA_KINDS.COLLECTOR]: () => undefined,
	[DAILY_BONUS_DATA_KINDS.COLLECTOR]: () => undefined,
	[SELL_DATA_KINDS.COLLECTOR]: () => undefined,
	[EQUIP_DATA_KINDS.COLLECTOR]: () => undefined,
	[BIG_EVENT_DATA_KINDS.COLLECTOR]: makeDataHandler(BIG_EVENT_DATA_KINDS.COLLECTOR, data => i18n.t(`events:${data.data.eventId}.text`)),
	[DRINK_DATA_KINDS.COLLECTOR]: () => undefined,
	[SMALL_EVENT_DATA_KINDS.ALTAR]: makeDataHandler(SMALL_EVENT_DATA_KINDS.ALTAR, data => promptIntro(data) + randomTranslation("smallEvents:altar.intro", {
		poolAmount: data.data.poolAmount,
		poolThreshold: data.data.poolThreshold,
		moneyEmote: AppIcons.getIcon("unitValues.money")
	})),
	[SMALL_EVENT_DATA_KINDS.BAD_PET]: makeDataHandler(SMALL_EVENT_DATA_KINDS.BAD_PET, data => randomTranslation("smallEvents:badPet.intro", {
		context: sexContext(data.data.sex),
		pet: petShortField({typeId: data.data.petId, sex: data.data.sex, ...data.data.petNickname ? {nickname: data.data.petNickname} : {}})
	})),
	[SMALL_EVENT_DATA_KINDS.CART]: makeDataHandler(SMALL_EVENT_DATA_KINDS.CART, data => promptIntro(data) + randomTranslation(
		`smallEvents:cart.${data.data.displayedDestination.isDisplayed ? "knownDestination" : "unknownDestination"}`,
		{
			price: data.data.price,
			moneyEmote: AppIcons.getIcon("unitValues.money"),
			destination: `${AppIcons.getIconOrNull(`mapTypes.${data.data.displayedDestination.type}`) ?? ""} ${i18n.t(`models:map_locations.${data.data.displayedDestination.id}.name`)}`
		}
	)),
	[SMALL_EVENT_DATA_KINDS.FIGHT_PET]: makeDataHandler(SMALL_EVENT_DATA_KINDS.FIGHT_PET, fightPetPrompt),
	[SMALL_EVENT_DATA_KINDS.GARDENER]: makeDataHandler(SMALL_EVENT_DATA_KINDS.GARDENER, data => promptIntro(data)
		+ randomTranslation(`smallEvents:gardener.stories.${data.data.isFirstEncounter === true ? "first" : "recurring"}`)
		+ randomTranslation("smallEvents:gardener.rewards.seed.paid", {cost: data.data.cost})),
	[SMALL_EVENT_DATA_KINDS.GOBLETS_GAME]: makeDataHandler(SMALL_EVENT_DATA_KINDS.GOBLETS_GAME, data => promptIntro(data) + i18n.t("smallEvents:gobletsGame.intro")),
	[SMALL_EVENT_DATA_KINDS.INTERACT_OTHER_PLAYERS]: makeDataHandler(SMALL_EVENT_DATA_KINDS.INTERACT_OTHER_PLAYERS, data => randomTranslation("smallEvents:interactOtherPlayers.poor", {
		playerDisplay: i18n.t(`smallEvents:interactOtherPlayers.playerDisplay${data.data.rank ? "Ranked" : "Unranked"}`, {pseudo: data.data.playerName ?? "", rank: data.data.rank})
	})),
	[SMALL_EVENT_DATA_KINDS.LIMOGES]: makeDataHandler(SMALL_EVENT_DATA_KINDS.LIMOGES, data =>
		joinParagraphs([
			`${promptIntro(data)}${randomTranslation("smallEvents:limoges.stories", {questionId: data.data.questionId})}`,
			i18n.t(`smallEvents:limoges.questions.${data.data.questionId}`)
		])),
	[SMALL_EVENT_DATA_KINDS.LOTTERY]: () => i18n.t("smallEvents:lottery.intro"),
	[SMALL_EVENT_DATA_KINDS.PET_FOOD]: makeDataHandler(SMALL_EVENT_DATA_KINDS.PET_FOOD, data => i18n.t(`smallEvents:petFood.intro.${data.data.foodType}`, {context: sexContext(data.data.petSex)})),
	[SMALL_EVENT_DATA_KINDS.PVE_ISLAND]: makeDataHandler(SMALL_EVENT_DATA_KINDS.PVE_ISLAND, data => joinParagraphs([
		`${promptIntro(data)}${randomTranslation("smallEvents:goToPVEIsland.stories", {
			priceText: i18n.t(`smallEvents:goToPVEIsland.price${data.data.price === 0 ? "Free" : "Money"}`, {price: data.data.price})
		})}`,
		i18n.t("smallEvents:goToPVEIsland.confirm", {energy: data.data.energy.current, energyMax: data.data.energy.max})
	])),
	[SMALL_EVENT_DATA_KINDS.SHOP]: makeDataHandler(SMALL_EVENT_DATA_KINDS.SHOP, data => shopPrompt(data.data)),
	[SMALL_EVENT_DATA_KINDS.EPIC_SHOP]: makeDataHandler(SMALL_EVENT_DATA_KINDS.EPIC_SHOP, data => randomTranslation("smallEvents:epicItemShop.intro", {price: data.data.price})
		+ (data.data.tip ? i18n.t("smallEvents:epicItemShop.reductionTip") : "")
		+ shopEnd(data.data)),
	[SMALL_EVENT_DATA_KINDS.RECIPE_SHOP]: makeDataHandler(SMALL_EVENT_DATA_KINDS.RECIPE_SHOP, data => i18n.t(`smallEvents:recipeShop.offer.${data.data.source}`, {
		recipe: i18n.t("models:cooking.recipeDisplay", data.data.recipe),
		price: data.data.recipeCost
	})),
	[SMALL_EVENT_DATA_KINDS.WITCH]: makeDataHandler(SMALL_EVENT_DATA_KINDS.WITCH, data => promptIntro(data)
		+ randomTranslation("smallEvents:witch.intro") + randomTranslation("smallEvents:witch.description") + randomTranslation("smallEvents:witch.situation")),
	[ITEM_DATA_KINDS.CHOICE]: () => undefined,
	[ITEM_DATA_KINDS.ACCEPT]: () => undefined,
	[REPORT_COLLECTOR_DATA_KINDS.DESTINATION]: () => i18n.t("app:collector.descriptions.destination"),
	[REPORT_COLLECTOR_DATA_KINDS.USE_TOKENS]: () => i18n.t("app:adventure.tokens.use.description"),
	[REPORT_COLLECTOR_DATA_KINDS.BUY_HEAL]: makeDataHandler(REPORT_COLLECTOR_DATA_KINDS.BUY_HEAL, data => i18n.t("app:adventure.heal.use.description", {
		price: data.data.healPrice,
		money: data.data.playerMoney
	})),
	[REPORT_COLLECTOR_DATA_KINDS.TOKEN_MERCHANT]: () => i18n.t("app:adventure.tokens.merchant.description"),
	[CITY_DATA_KINDS.CITY]: () => undefined,
	[SHOP_DATA_KINDS.COLLECTOR]: () => i18n.t("app:city.shop.description"),
	[SHOP_DATA_KINDS.SKIP_MISSION]: () => plainStory(i18n.t("commands:shop.shopItems.skipMission.giveDesc")),
	[SHOP_DATA_KINDS.BUY_SLOT]: () => plainStory(i18n.t("commands:shop.chooseSlotIndication")),
	[UNKNOWN_COLLECTOR_KIND]: () => undefined
};

const REACTION_LABEL_HANDLERS: Record<ReactionCollectorReaction["type"], ReactionHandler> = {
	[FIGHT_REACTION_KINDS.ACTION]: makeReactionHandler(FIGHT_REACTION_KINDS.ACTION, reaction => fightActionName(reaction.data.id)),
	[PET_MANAGEMENT_REACTION_KINDS.DEPOSIT]: (_reaction, data) => i18n.t("app:pet.management.deposit", {pet: data.type === PET_MANAGEMENT_DATA_KINDS.TRANSFER && data.data.ownPet ? petName(data.data.ownPet) : ""}),
	[PET_MANAGEMENT_REACTION_KINDS.WITHDRAW]: makeReactionHandler(PET_MANAGEMENT_REACTION_KINDS.WITHDRAW, (reaction, data) => i18n.t("app:pet.management.withdraw", {pet: shelterPetLabel(reaction, data)})),
	[PET_MANAGEMENT_REACTION_KINDS.SWITCH]: makeReactionHandler(PET_MANAGEMENT_REACTION_KINDS.SWITCH, (reaction, data) => i18n.t("app:pet.management.switch", {pet: shelterPetLabel(reaction, data)})),
	[PET_MANAGEMENT_REACTION_KINDS.FREE_SELECT]: makeReactionHandler(PET_MANAGEMENT_REACTION_KINDS.FREE_SELECT, (reaction, data) => shelterPetLabel(reaction, data)),
	[EXPEDITION_REACTION_KINDS.SELECT]: () => i18n.t("app:expedition.start"),
	[EXPEDITION_REACTION_KINDS.CANCEL]: () => i18n.t("app:collector.refuse"),
	[EXPEDITION_REACTION_KINDS.RECALL]: () => i18n.t("app:expedition.recall"),
	[EXPEDITION_REACTION_KINDS.CLOSE]: () => i18n.t("app:common.back"),
	[EXPEDITION_REACTION_KINDS.CLAIM]: () => i18n.t("app:expedition.claim"),
	[PET_FEED_REACTION_KINDS.FOOD]: makeReactionHandler(PET_FEED_REACTION_KINDS.FOOD, reaction => i18n.t("app:pet.feed.food", {food: withIcon(`foods.${reaction.data.food}`, i18n.t(`models:foods.${reaction.data.food}`, {count: 1})), amount: reaction.data.amount, max: reaction.data.maxAmount})),
	[CLASSES_REACTION_KINDS.CHOOSE]: makeReactionHandler(CLASSES_REACTION_KINDS.CHOOSE, reaction => withIcon(`classes.${reaction.data.classId}`, i18n.t(`models:classes.${reaction.data.classId}`))),
	[DAILY_BONUS_REACTION_KINDS.OBJECT]: makeReactionHandler(DAILY_BONUS_REACTION_KINDS.OBJECT, reaction => itemDisplayName(reaction.data.object)),
	[SELL_REACTION_KINDS.ITEM]: makeReactionHandler(SELL_REACTION_KINDS.ITEM, reaction => itemDisplayName(reaction.data.item)),
	[EQUIP_REACTION_KINDS.CLOSE]: () => i18n.t("app:equipment.close"),
	[GENERIC_REACTION_KINDS.ACCEPT]: (_reaction, data) => data.type === SMALL_EVENT_DATA_KINDS.PVE_ISLAND
		? withIcon("collectors.accept", i18n.t("app:collector.pveIsland.embark"))
		: data.type === SMALL_EVENT_DATA_KINDS.CART
			? withIcon("cartSmallEvent.accept", i18n.t("app:collector.cart.accept"))
			: withIcon("collectors.accept", i18n.t("app:collector.accept")),
	[GENERIC_REACTION_KINDS.REFUSE]: (_reaction, data) => withIcon("collectors.refuse", i18n.t(data.type === SMALL_EVENT_DATA_KINDS.PVE_ISLAND
		? "app:collector.pveIsland.continueJourney"
		: data.type === SMALL_EVENT_DATA_KINDS.CART ? "app:collector.cart.refuse" : "app:collector.refuse")),
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
	[SMALL_EVENT_REACTION_KINDS.FIGHT_PET]: makeReactionHandler(SMALL_EVENT_REACTION_KINDS.FIGHT_PET, reaction =>
		withIcon(`fightPetActions.${reaction.data.actionId}`, i18n.t(`smallEvents:fightPet.fightPetActions.${reaction.data.actionId}.name`))),
	[SMALL_EVENT_REACTION_KINDS.GOBLETS_GAME]: makeReactionHandler(SMALL_EVENT_REACTION_KINDS.GOBLETS_GAME, (reaction, data) => {
		if (!isDataOfType(data, SMALL_EVENT_DATA_KINDS.GOBLETS_GAME) || !isKnownGoblet(reaction.data.id, reaction.data.strategy)) {
			return i18n.t("app:collector.unknownChoice");
		}
		return withIcon(`goblets.${reaction.data.id}`, i18n.t(`smallEvents:gobletsGame.goblets.${reaction.data.id}.name`));
	}),
	[SMALL_EVENT_REACTION_KINDS.LOTTERY_EASY]: () => withIcon("collectors.lottery.easy", i18n.t("app:collector.choices.lotteryEasy")),
	[SMALL_EVENT_REACTION_KINDS.LOTTERY_MEDIUM]: () => withIcon("collectors.lottery.medium", i18n.t("app:collector.choices.lotteryMedium")),
	[SMALL_EVENT_REACTION_KINDS.LOTTERY_HARD]: () => withIcon("collectors.lottery.hard", i18n.t("app:collector.choices.lotteryHard")),
	[SMALL_EVENT_REACTION_KINDS.PET_FOOD_INVESTIGATE]: () => withIcon("collectors.question", i18n.t("smallEvents:petFood.choices.investigate")),
	[SMALL_EVENT_REACTION_KINDS.PET_FOOD_SEND_PET]: () => withIcon("smallEvents.pet", i18n.t("smallEvents:petFood.choices.sendPet")),
	[SMALL_EVENT_REACTION_KINDS.PET_FOOD_CONTINUE]: () => withIcon("smallEvents.doNothing", i18n.t("smallEvents:petFood.choices.continue")),
	[SMALL_EVENT_REACTION_KINDS.WITCH]: makeReactionHandler(SMALL_EVENT_REACTION_KINDS.WITCH, reaction => {
		if (AppIcons.getIconOrNull(`witchSmallEvent.${reaction.data.id}`) === null) {
			return i18n.t("app:collector.unknownChoice");
		}
		return withIcon(`witchSmallEvent.${reaction.data.id}`, i18n.t(`smallEvents:witch.witchEventNames.${reaction.data.id}`));
	}),
	[ITEM_REACTION_KINDS.CHOICE_ITEM]: makeReactionHandler(ITEM_REACTION_KINDS.CHOICE_ITEM, reaction =>
		withIcon(itemIconPath(reaction.data.itemWithDetails) ?? "collectors.warning", itemDisplayName(reaction.data.itemWithDetails))),
	[ITEM_REACTION_KINDS.CHOICE_DRINK_POTION]: () => withIcon("collectors.accept", i18n.t("app:collector.choices.drinkPotion")),
	[ITEM_REACTION_KINDS.CHOICE_REFUSE]: () => withIcon("collectors.refuse", i18n.t("app:collector.refuse")),
	[ITEM_REACTION_KINDS.ACCEPT_DRINK_POTION]: () => withIcon("collectors.accept", i18n.t("app:collector.choices.drinkPotion")),
	[REPORT_COLLECTOR_REACTION_KINDS.DESTINATION]: makeReactionHandler(REPORT_COLLECTOR_REACTION_KINDS.DESTINATION, reaction => {
		const icon = AppIcons.getIconOrNull(`mapTypes.${reaction.data.mapTypeId}`);
		const destination = i18n.t(`models:map_locations.${reaction.data.mapId}.name`);
		return i18n.t("app:collector.choices.destination", {
			destination: icon ? `${icon} ${destination}` : destination,
			duration: destinationDuration(reaction.data.tripDurationMinutes)
		});
	}),
	[REPORT_COLLECTOR_REACTION_KINDS.STAY_IN_CITY]: () => withIcon("other.stay", i18n.t("app:collector.choices.stayInCity")),
	[REPORT_COLLECTOR_REACTION_KINDS.TOKEN_MERCHANT_BUY]: makeReactionHandler(REPORT_COLLECTOR_REACTION_KINDS.TOKEN_MERCHANT_BUY, (reaction, data) => {
		if (!isDataOfType(data, REPORT_COLLECTOR_DATA_KINDS.TOKEN_MERCHANT)) {
			return i18n.t("app:collector.unknownChoice");
		}
		const {amount} = reaction.data;
		const price = amount * data.data.pricePerToken;
		return i18n.t(amount === 1 ? "app:adventure.tokens.merchant.buyOne" : "app:adventure.tokens.merchant.buyMany", {amount, price});
	}),
	[SHOP_REACTION_KINDS.ITEM]: makeReactionHandler(SHOP_REACTION_KINDS.ITEM, (reaction, data) => {
		if (!isDataOfType(data, SHOP_DATA_KINDS.COLLECTOR)) {
			return i18n.t("app:collector.unknownChoice");
		}
		return i18n.t("app:city.shop.item", {
			item: shopItemName({shopItemId: reaction.data.shopItemId}),
			amount: reaction.data.amount,
			price: reaction.data.price,
			currency: AppIcons.getIcon(`unitValues.${data.data.currency}`)
		});
	}),
	[SHOP_REACTION_KINDS.CLOSE]: () => withIcon("collectors.refuse", i18n.t("app:city.shop.close")),
	[SHOP_REACTION_KINDS.SKIP_MISSION_ENTRY]: makeReactionHandler(SHOP_REACTION_KINDS.SKIP_MISSION_ENTRY, reaction =>
		plainStory(missionDescription(reaction.data.mission, Date.now()))),
	[SHOP_REACTION_KINDS.BUY_SLOT_CATEGORY]: makeReactionHandler(SHOP_REACTION_KINDS.BUY_SLOT_CATEGORY, reaction =>
		withIcon(`itemKinds.${reaction.data.categoryId}`, plainStory(i18n.t(`commands:shop.slotCategoriesKind.${reaction.data.categoryId}`)))),
	[CITY_REACTION_KINDS.EXIT]: makeReactionHandler(CITY_REACTION_KINDS.EXIT, () => withIcon("other.walking", i18n.t("commands:report.city.reactions.exit.label"))),
	[CITY_REACTION_KINDS.INN_MEAL]: makeReactionHandler(CITY_REACTION_KINDS.INN_MEAL, reaction => `${withIcon("city.inn", i18n.t(`commands:report.city.inns.meals.${reaction.data.mealId}`))} · ${i18n.t("commands:report.city.inns.mealDescription", reaction.data)}`),
	[CITY_REACTION_KINDS.INN_ROOM]: makeReactionHandler(CITY_REACTION_KINDS.INN_ROOM, reaction => `${withIcon("city.inn", i18n.t(`commands:report.city.inns.rooms.${reaction.data.roomId}`))} · ${i18n.t("commands:report.city.inns.roomDescription", reaction.data)}`),
	[CITY_REACTION_KINDS.ENCHANT]: makeReactionHandler(CITY_REACTION_KINDS.ENCHANT, () => cityReactionLabel("enchant")),
	[CITY_REACTION_KINDS.SHOP]: makeReactionHandler(CITY_REACTION_KINDS.SHOP, reaction => withIcon(`city.shops.${reaction.data.shopId}`, cityServiceLabel(reaction.data.shopId))),
	[CITY_REACTION_KINDS.BUY_HOME]: makeReactionHandler(CITY_REACTION_KINDS.BUY_HOME, () => cityReactionLabel("buyHome")),
	[CITY_REACTION_KINDS.UPGRADE_HOME]: makeReactionHandler(CITY_REACTION_KINDS.UPGRADE_HOME, () => cityReactionLabel("upgradeHome")),
	[CITY_REACTION_KINDS.MOVE_HOME]: makeReactionHandler(CITY_REACTION_KINDS.MOVE_HOME, () => cityReactionLabel("moveHome")),
	[CITY_REACTION_KINDS.HOME_MENU]: makeReactionHandler(CITY_REACTION_KINDS.HOME_MENU, () => cityReactionLabel("home")),
	[CITY_REACTION_KINDS.HOME_BED]: makeReactionHandler(CITY_REACTION_KINDS.HOME_BED, () => cityReactionLabel("bed")),
	[CITY_REACTION_KINDS.UPGRADE_ITEM]: makeReactionHandler(CITY_REACTION_KINDS.UPGRADE_ITEM, () => cityReactionLabel("upgradeItem")),
	[CITY_REACTION_KINDS.BLACKSMITH_MENU]: makeReactionHandler(CITY_REACTION_KINDS.BLACKSMITH_MENU, () => cityReactionLabel("blacksmith")),
	[CITY_REACTION_KINDS.BLACKSMITH_UPGRADE]: makeReactionHandler(CITY_REACTION_KINDS.BLACKSMITH_UPGRADE, reaction => i18n.t("app:city.reactions.blacksmithUpgrade", {buyMaterials: reaction.data.buyMaterials})),
	[CITY_REACTION_KINDS.BLACKSMITH_DISENCHANT]: makeReactionHandler(CITY_REACTION_KINDS.BLACKSMITH_DISENCHANT, () => cityReactionLabel("disenchant")),
	[CITY_REACTION_KINDS.SCRAP_DEALER_MENU]: makeReactionHandler(CITY_REACTION_KINDS.SCRAP_DEALER_MENU, () => cityReactionLabel("scrapDealer")),
	[CITY_REACTION_KINDS.SCRAP_DEALER_RECYCLE]: makeReactionHandler(CITY_REACTION_KINDS.SCRAP_DEALER_RECYCLE, () => cityReactionLabel("recycle")),
	[CITY_REACTION_KINDS.ROYAL_BLACKSMITH_MENU]: makeReactionHandler(CITY_REACTION_KINDS.ROYAL_BLACKSMITH_MENU, () => cityReactionLabel("royalBlacksmith")),
	[CITY_REACTION_KINDS.ROYAL_BLACKSMITH_UPGRADE]: makeReactionHandler(CITY_REACTION_KINDS.ROYAL_BLACKSMITH_UPGRADE, reaction => i18n.t("app:city.reactions.royalBlacksmithUpgrade", {buyMaterials: reaction.data.buyMaterials})),
	[CITY_REACTION_KINDS.GARDEN_HARVEST]: makeReactionHandler(CITY_REACTION_KINDS.GARDEN_HARVEST, () => cityReactionLabel("gardenHarvest")),
	[CITY_REACTION_KINDS.GARDEN_WATER]: makeReactionHandler(CITY_REACTION_KINDS.GARDEN_WATER, () => cityReactionLabel("gardenWater")),
	[CITY_REACTION_KINDS.GARDEN_COMPOST]: makeReactionHandler(CITY_REACTION_KINDS.GARDEN_COMPOST, reaction => i18n.t("app:city.reactions.gardenCompost", reaction.data)),
	[CITY_REACTION_KINDS.GUILD_DOMAIN_MENU]: makeReactionHandler(CITY_REACTION_KINDS.GUILD_DOMAIN_MENU, () => cityReactionLabel("guildDomain")),
	[CITY_REACTION_KINDS.GUILD_DOMAIN_NOTARY]: makeReactionHandler(CITY_REACTION_KINDS.GUILD_DOMAIN_NOTARY, () => cityReactionLabel("guildNotary")),
	[CITY_REACTION_KINDS.APARTMENT_BUY]: makeReactionHandler(CITY_REACTION_KINDS.APARTMENT_BUY, () => cityReactionLabel("apartmentBuy")),
	[CITY_REACTION_KINDS.APARTMENT_CLAIM_RENT]: makeReactionHandler(CITY_REACTION_KINDS.APARTMENT_CLAIM_RENT, () => cityReactionLabel("claimRent")),
	[UNKNOWN_COLLECTOR_KIND]: () => i18n.t("app:collector.unknownChoice")
};

const CHOOSABLE_HANDLERS: Record<ReactionCollectorReaction["type"], ChoosableHandler> = {
	[FIGHT_REACTION_KINDS.ACTION]: (_reaction, data) => isDataOfType(data, FIGHT_DATA_KINDS.ACTION),
	[PET_MANAGEMENT_REACTION_KINDS.DEPOSIT]: (_reaction, data) => isDataOfType(data, PET_MANAGEMENT_DATA_KINDS.TRANSFER),
	[PET_MANAGEMENT_REACTION_KINDS.WITHDRAW]: (_reaction, data) => isDataOfType(data, PET_MANAGEMENT_DATA_KINDS.TRANSFER),
	[PET_MANAGEMENT_REACTION_KINDS.SWITCH]: (_reaction, data) => isDataOfType(data, PET_MANAGEMENT_DATA_KINDS.TRANSFER),
	[PET_MANAGEMENT_REACTION_KINDS.FREE_SELECT]: (_reaction, data) => isDataOfType(data, PET_MANAGEMENT_DATA_KINDS.FREE_SELECT),
	[EXPEDITION_REACTION_KINDS.SELECT]: (_reaction, data) => isDataOfType(data, EXPEDITION_DATA_KINDS.CHOICE),
	[EXPEDITION_REACTION_KINDS.CANCEL]: (_reaction, data) => isDataOfType(data, EXPEDITION_DATA_KINDS.CHOICE),
	[EXPEDITION_REACTION_KINDS.RECALL]: (_reaction, data) => isDataOfType(data, EXPEDITION_DATA_KINDS.PROGRESS),
	[EXPEDITION_REACTION_KINDS.CLOSE]: (_reaction, data) => isDataOfType(data, EXPEDITION_DATA_KINDS.PROGRESS),
	[EXPEDITION_REACTION_KINDS.CLAIM]: (_reaction, data) => isDataOfType(data, EXPEDITION_DATA_KINDS.FINISHED),
	[PET_FEED_REACTION_KINDS.FOOD]: makeChoosableHandler(PET_FEED_REACTION_KINDS.FOOD, (reaction, data) => isDataOfType(data, PET_FEED_DATA_KINDS.GUILD) && reaction.data.amount > 0),
	[CLASSES_REACTION_KINDS.CHOOSE]: (_reaction, data) => isDataOfType(data, CLASSES_DATA_KINDS.COLLECTOR),
	[DAILY_BONUS_REACTION_KINDS.OBJECT]: (_reaction, data) => isDataOfType(data, DAILY_BONUS_DATA_KINDS.COLLECTOR),
	[SELL_REACTION_KINDS.ITEM]: (_reaction, data) => isDataOfType(data, SELL_DATA_KINDS.COLLECTOR),
	[EQUIP_REACTION_KINDS.CLOSE]: (_reaction, data) => isDataOfType(data, EQUIP_DATA_KINDS.COLLECTOR),
	[GENERIC_REACTION_KINDS.ACCEPT]: () => true,
	[GENERIC_REACTION_KINDS.REFUSE]: () => true,
	[DRINK_REACTION_KINDS.POTION]: () => true,
	[BIG_EVENT_REACTION_KINDS.POSSIBILITY]: makeChoosableHandler(BIG_EVENT_REACTION_KINDS.POSSIBILITY, (_reaction, data) => isDataOfType(data, BIG_EVENT_DATA_KINDS.COLLECTOR)),
	[SMALL_EVENT_REACTION_KINDS.ALTAR_CONTRIBUTE]: () => true,
	[SMALL_EVENT_REACTION_KINDS.BAD_PET]: makeChoosableHandler(SMALL_EVENT_REACTION_KINDS.BAD_PET, reaction => BAD_PET_ACTION_IDS.has(reaction.data.id)),
	[SMALL_EVENT_REACTION_KINDS.FIGHT_PET]: makeChoosableHandler(SMALL_EVENT_REACTION_KINDS.FIGHT_PET, (_reaction, data) => isDataOfType(data, SMALL_EVENT_DATA_KINDS.FIGHT_PET)),
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
	[REPORT_COLLECTOR_REACTION_KINDS.TOKEN_MERCHANT_BUY]: makeChoosableHandler(REPORT_COLLECTOR_REACTION_KINDS.TOKEN_MERCHANT_BUY, (_reaction, data) => isDataOfType(data, REPORT_COLLECTOR_DATA_KINDS.TOKEN_MERCHANT)),
	[SHOP_REACTION_KINDS.ITEM]: makeChoosableHandler(SHOP_REACTION_KINDS.ITEM, (_reaction, data) => isDataOfType(data, SHOP_DATA_KINDS.COLLECTOR)),
	[SHOP_REACTION_KINDS.CLOSE]: () => true,
	[SHOP_REACTION_KINDS.SKIP_MISSION_ENTRY]: makeChoosableHandler(SHOP_REACTION_KINDS.SKIP_MISSION_ENTRY, (_reaction, data) => isDataOfType(data, SHOP_DATA_KINDS.SKIP_MISSION)),
	[SHOP_REACTION_KINDS.BUY_SLOT_CATEGORY]: makeChoosableHandler(SHOP_REACTION_KINDS.BUY_SLOT_CATEGORY, (_reaction, data) => isDataOfType(data, SHOP_DATA_KINDS.BUY_SLOT)),
	[CITY_REACTION_KINDS.EXIT]: makeChoosableHandler(CITY_REACTION_KINDS.EXIT, (_reaction, data) => isDataOfType(data, CITY_DATA_KINDS.CITY)),
	[CITY_REACTION_KINDS.INN_MEAL]: makeChoosableHandler(CITY_REACTION_KINDS.INN_MEAL, (_reaction, data) => isDataOfType(data, CITY_DATA_KINDS.CITY)),
	[CITY_REACTION_KINDS.INN_ROOM]: makeChoosableHandler(CITY_REACTION_KINDS.INN_ROOM, (_reaction, data) => isDataOfType(data, CITY_DATA_KINDS.CITY)),
	[CITY_REACTION_KINDS.ENCHANT]: makeChoosableHandler(CITY_REACTION_KINDS.ENCHANT, (_reaction, data) => isDataOfType(data, CITY_DATA_KINDS.CITY)),
	[CITY_REACTION_KINDS.SHOP]: makeChoosableHandler(CITY_REACTION_KINDS.SHOP, (_reaction, data) => isDataOfType(data, CITY_DATA_KINDS.CITY)),
	[CITY_REACTION_KINDS.BUY_HOME]: makeChoosableHandler(CITY_REACTION_KINDS.BUY_HOME, (_reaction, data) => isDataOfType(data, CITY_DATA_KINDS.CITY)),
	[CITY_REACTION_KINDS.UPGRADE_HOME]: makeChoosableHandler(CITY_REACTION_KINDS.UPGRADE_HOME, (_reaction, data) => isDataOfType(data, CITY_DATA_KINDS.CITY)),
	[CITY_REACTION_KINDS.MOVE_HOME]: makeChoosableHandler(CITY_REACTION_KINDS.MOVE_HOME, (_reaction, data) => isDataOfType(data, CITY_DATA_KINDS.CITY)),
	[CITY_REACTION_KINDS.HOME_MENU]: makeChoosableHandler(CITY_REACTION_KINDS.HOME_MENU, (_reaction, data) => isDataOfType(data, CITY_DATA_KINDS.CITY)),
	[CITY_REACTION_KINDS.HOME_BED]: makeChoosableHandler(CITY_REACTION_KINDS.HOME_BED, (_reaction, data) => isDataOfType(data, CITY_DATA_KINDS.CITY)),
	[CITY_REACTION_KINDS.UPGRADE_ITEM]: makeChoosableHandler(CITY_REACTION_KINDS.UPGRADE_ITEM, (_reaction, data) => isDataOfType(data, CITY_DATA_KINDS.CITY)),
	[CITY_REACTION_KINDS.BLACKSMITH_MENU]: makeChoosableHandler(CITY_REACTION_KINDS.BLACKSMITH_MENU, (_reaction, data) => isDataOfType(data, CITY_DATA_KINDS.CITY)),
	[CITY_REACTION_KINDS.BLACKSMITH_UPGRADE]: makeChoosableHandler(CITY_REACTION_KINDS.BLACKSMITH_UPGRADE, (_reaction, data) => isDataOfType(data, CITY_DATA_KINDS.CITY)),
	[CITY_REACTION_KINDS.BLACKSMITH_DISENCHANT]: makeChoosableHandler(CITY_REACTION_KINDS.BLACKSMITH_DISENCHANT, (_reaction, data) => isDataOfType(data, CITY_DATA_KINDS.CITY)),
	[CITY_REACTION_KINDS.SCRAP_DEALER_MENU]: makeChoosableHandler(CITY_REACTION_KINDS.SCRAP_DEALER_MENU, (_reaction, data) => isDataOfType(data, CITY_DATA_KINDS.CITY)),
	[CITY_REACTION_KINDS.SCRAP_DEALER_RECYCLE]: makeChoosableHandler(CITY_REACTION_KINDS.SCRAP_DEALER_RECYCLE, (_reaction, data) => isDataOfType(data, CITY_DATA_KINDS.CITY)),
	[CITY_REACTION_KINDS.ROYAL_BLACKSMITH_MENU]: makeChoosableHandler(CITY_REACTION_KINDS.ROYAL_BLACKSMITH_MENU, (_reaction, data) => isDataOfType(data, CITY_DATA_KINDS.CITY)),
	[CITY_REACTION_KINDS.ROYAL_BLACKSMITH_UPGRADE]: makeChoosableHandler(CITY_REACTION_KINDS.ROYAL_BLACKSMITH_UPGRADE, (_reaction, data) => isDataOfType(data, CITY_DATA_KINDS.CITY)),
	[CITY_REACTION_KINDS.GARDEN_HARVEST]: makeChoosableHandler(CITY_REACTION_KINDS.GARDEN_HARVEST, (_reaction, data) => isDataOfType(data, CITY_DATA_KINDS.CITY)),
	[CITY_REACTION_KINDS.GARDEN_WATER]: makeChoosableHandler(CITY_REACTION_KINDS.GARDEN_WATER, (_reaction, data) => isDataOfType(data, CITY_DATA_KINDS.CITY)),
	[CITY_REACTION_KINDS.GARDEN_COMPOST]: makeChoosableHandler(CITY_REACTION_KINDS.GARDEN_COMPOST, (_reaction, data) => isDataOfType(data, CITY_DATA_KINDS.CITY)),
	[CITY_REACTION_KINDS.GUILD_DOMAIN_MENU]: makeChoosableHandler(CITY_REACTION_KINDS.GUILD_DOMAIN_MENU, (_reaction, data) => isDataOfType(data, CITY_DATA_KINDS.CITY)),
	[CITY_REACTION_KINDS.GUILD_DOMAIN_NOTARY]: makeChoosableHandler(CITY_REACTION_KINDS.GUILD_DOMAIN_NOTARY, (_reaction, data) => isDataOfType(data, CITY_DATA_KINDS.CITY)),
	[CITY_REACTION_KINDS.APARTMENT_BUY]: makeChoosableHandler(CITY_REACTION_KINDS.APARTMENT_BUY, (_reaction, data) => isDataOfType(data, CITY_DATA_KINDS.CITY)),
	[CITY_REACTION_KINDS.APARTMENT_CLAIM_RENT]: makeChoosableHandler(CITY_REACTION_KINDS.APARTMENT_CLAIM_RENT, (_reaction, data) => isDataOfType(data, CITY_DATA_KINDS.CITY)),
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

/** The emoji heading each event's journal entry on Discord; the recipe seller lends the one of their own small event. */
const EVENT_ICON_PATHS: Partial<Record<ReactionCollectorData["type"], (data: ReactionCollectorData) => string>> = {
	[BIG_EVENT_DATA_KINDS.COLLECTOR]: () => "commands.report",
	[SMALL_EVENT_DATA_KINDS.ALTAR]: () => "smallEvents.altar",
	[SMALL_EVENT_DATA_KINDS.BAD_PET]: () => "smallEvents.badPet",
	[SMALL_EVENT_DATA_KINDS.CART]: () => "smallEvents.cart",
	[SMALL_EVENT_DATA_KINDS.FIGHT_PET]: () => "smallEvents.fightPet",
	[SMALL_EVENT_DATA_KINDS.GARDENER]: () => "smallEvents.gardener",
	[SMALL_EVENT_DATA_KINDS.GOBLETS_GAME]: () => "smallEvents.gobletsGame",
	[SMALL_EVENT_DATA_KINDS.INTERACT_OTHER_PLAYERS]: () => "smallEvents.interactOtherPlayers",
	[SMALL_EVENT_DATA_KINDS.LIMOGES]: () => "smallEvents.limoges",
	[SMALL_EVENT_DATA_KINDS.LOTTERY]: () => "smallEvents.lottery",
	[SMALL_EVENT_DATA_KINDS.PET_FOOD]: () => "smallEvents.petFood",
	[SMALL_EVENT_DATA_KINDS.PVE_ISLAND]: () => "smallEvents.goToPVEIsland",
	[SMALL_EVENT_DATA_KINDS.SHOP]: () => "smallEvents.shop",
	[SMALL_EVENT_DATA_KINDS.EPIC_SHOP]: () => "smallEvents.epicItemShop",
	[SMALL_EVENT_DATA_KINDS.RECIPE_SHOP]: data => data.type === SMALL_EVENT_DATA_KINDS.RECIPE_SHOP && data.data.source === "gaspardJo"
		? "smallEvents.ultimateFoodMerchant"
		: "smallEvents.farmer",
	[SMALL_EVENT_DATA_KINDS.WITCH]: () => "smallEvents.witch"
};

/** Whether the collector is an event of the journey, told as a journal entry rather than a menu. */
export function isEventPrompt(data: ReactionCollectorData): boolean {
	return EVENT_ICON_PATHS[data.type] !== undefined;
}

export function eventPromptIcon(data: ReactionCollectorData): string | undefined {
	const path = EVENT_ICON_PATHS[data.type]?.(data);
	return path ? AppIcons.getIconOrNull(path) ?? undefined : undefined;
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
