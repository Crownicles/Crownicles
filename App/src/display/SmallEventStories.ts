import {SmallEventResultData} from "ws-packets/src/fromServer/smallEvents/SmallEventResultRes";
import {Mission} from "ws-packets/src/objects/Mission";
import {PetSex} from "ws-packets/src/objects/OwnedPet";
import {AppIcons} from "@/src/AppIcons";
import {formatDurationMinutes} from "@/src/display/ItemEffects";
import {missionDate, missionDescription} from "@/src/display/Missions";
import {petIcon, petName, petShortField} from "@/src/display/PetDisplay";
import {anyTranslation} from "@/src/translations/RandomTranslation";
import {i18n} from "@/src/translations/i18n";
import {joinParagraphs} from "@/src/display/Paragraphs";

/**
 * The stories Discord tells for the small events that ask nothing of the player, rebuilt from the
 * same translations and the same packet fields so both front ends tell the same adventure.
 */

type Data = SmallEventResultData;
type StoryBuilder = (data: Data) => string;

function num(data: Data, key: string): number | undefined {
	const value = data[key];
	return typeof value === "number" ? value : undefined;
}

function str(data: Data, key: string): string | undefined {
	const value = data[key];
	return typeof value === "string" ? value : undefined;
}

function record(data: Data, key: string): Data | undefined {
	const value = data[key];
	return typeof value === "object" && value !== null && !Array.isArray(value) ? value : undefined;
}

function sex(value: unknown): PetSex {
	return value === "f" ? "f" : "m";
}

function sexContext(value: unknown): string {
	return sex(value);
}

function t(key: string, options: Record<string, unknown> = {}): string {
	return i18n.t(`smallEvents:${key}`, options);
}

function any(key: string, options: Record<string, unknown> = {}): string {
	return anyTranslation(`smallEvents:${key}`, options);
}

export function smallEventIntro(): string {
	return any("intro");
}

function duration(minutes: number | undefined): string {
	return formatDurationMinutes(minutes ?? 0);
}

function icon(path: string): string {
	return AppIcons.getIconOrNull(path) ?? "";
}

function pet(data: Data, fields: {type: string; sex: string; nickname?: string}): string {
	const nickname = fields.nickname ? str(data, fields.nickname) : undefined;
	return petShortField({typeId: num(data, fields.type) ?? 0, sex: sex(data[fields.sex]), ...nickname ? {nickname} : {}});
}

const OWN_PET = {type: "petTypeId", sex: "petSex", nickname: "petNickname"};

/** The other player's class, in the singular and plural forms the interaction texts use. */
function classDisplays(details: Data): {class: string; classPlural: string} {
	const id = num(details, "classId") ?? 0;
	return {class: i18n.t("models:classFormat", {id}), classPlural: i18n.t("models:classPluralFormat", {id})};
}

/** Where each piece of the other player's equipment is named, keyed by the text parameter that shows it. */
const EQUIPMENT_FIELDS = {
	weapon: ["weapons", "weaponId"],
	armor: ["armors", "armorId"],
	object: ["objects", "objectId"],
	potion: ["potions", "potionId"]
} as const;

function equipmentDisplays(details: Data): Record<keyof typeof EQUIPMENT_FIELDS, string> {
	const entries = Object.entries(EQUIPMENT_FIELDS).map(([slot, [category, field]]) => {
		const id = num(details, field);
		return [slot, `${icon(`${category}.${id}`)} ${i18n.t(`models:${category}.${id}`)}`];
	});
	return Object.fromEntries(entries) as Record<keyof typeof EQUIPMENT_FIELDS, string>;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** The "in 3 days" Discord renders from a timestamp, or the date itself where the platform cannot phrase it. */
function timeUntil(timestamp: number): string {
	if (typeof Intl.RelativeTimeFormat !== "function") {
		return missionDate(timestamp);
	}
	const left = timestamp - Date.now();
	const format = new Intl.RelativeTimeFormat(i18n.language, {numeric: "auto"});
	if (Math.abs(left) >= DAY_MS) return format.format(Math.round(left / DAY_MS), "day");
	if (Math.abs(left) >= HOUR_MS) return format.format(Math.round(left / HOUR_MS), "hour");
	return format.format(Math.round(left / MINUTE_MS), "minute");
}

const BIG_BAD_STORIES: Record<string, StoryBuilder> = {
	LIFE_LOSS: data => any("bigBad.lifeLoss", {lifeLoss: num(data, "lifeLost")}),
	ALTERATION: data => `${t(`bigBad.alterationStories.${str(data, "receivedStory")}`)} ${icon(`effects.${str(data, "effectId")}`)}`,
	MONEY_LOSS: data => any("bigBad.moneyLoss", {moneyLost: num(data, "moneyLost")})
};

function dwarfPetFanStory(data: Data): string {
	const hasPet = num(data, "petTypeId") !== undefined;
	const amount = num(data, "amount");
	return `${any("dwarfPetFan.intro")} ${any(`dwarfPetFan.${str(data, "interactionName")}`, {
		...hasPet ? {context: data.petSex} : {},
		pet: hasPet ? pet(data, OWN_PET) : "",
		reward: amount === undefined ? "" : t(`dwarfPetFan.reward.${data.isGemReward === true ? "gem" : "money"}`, {amount})
	})}`;
}

function expeditionPet(data: Data): string {
	return num(data, "petTypeId") === undefined ? i18n.t("commands:pet.defaultPetName") : pet(data, OWN_PET);
}

function expeditionBonusKey(data: Data): string {
	if (data.bonusCombatPotion) return "expeditionAdvice.expeditionBonus.combatPotion";
	if (data.bonusItem) return "expeditionAdvice.expeditionBonus.pointsAndItem";
	if (data.bonusMoney) return "expeditionAdvice.expeditionBonus.pointsAndMoney";
	return "expeditionAdvice.expeditionBonus.points";
}

const EXPEDITION_STORIES: Record<string, StoryBuilder> = {
	conditionNotMetPetHungry: data => any("expeditionAdvice.conditions.petHungry", {pet: expeditionPet(data)}),
	conditionNotMetPetFeisty: data => any("expeditionAdvice.conditions.petFeisty", {pet: expeditionPet(data)}),
	conditionNotMetPetNotSeenByTalvar: data => any("expeditionAdvice.conditions.petNotSeenByTalvar", {pet: expeditionPet(data)}),
	conditionNotMetNoPet: () => any("expeditionAdvice.conditions.noPet"),
	conditionNotMetNoGuild: () => any("expeditionAdvice.conditions.noGuild"),
	conditionNotMetLevelTooLow: data => any("expeditionAdvice.conditions.levelTooLow", {
		requiredLevel: num(data, "requiredLevel"), playerLevel: num(data, "playerLevel"), count: num(data, "consolationTokensAmount")
	}),
	talismanIntro: data => {
		const intros = i18n.tArray("smallEvents:expeditionAdvice.talismanIntro");
		return intros[(num(data, "encounterCount") ?? 1) - 1] ?? intros[0];
	},
	talismanReceived: data => any("expeditionAdvice.talismanReceived", {pet: expeditionPet(data)}),
	expeditionBonus: data => t(expeditionBonusKey(data), {pet: expeditionPet(data), bonusPoints: num(data, "bonusPoints"), bonusMoney: num(data, "bonusMoney")})
};

function findMaterialStory(data: Data): string {
	const materialId = str(data, "materialId");
	const rarity = num(data, "materialRarity") ?? 1;
	return joinParagraphs([
		`${smallEventIntro()}${t(`findMaterial.typesStories.${str(data, "materialType")}`)}`,
		t(`findMaterial.foundStories.${rarity}`, {
			materialId, materialEmote: icon(`materials.${materialId}`), rarityEmote: icon(`rarity.${rarity - 1}`), quantity: num(data, "quantity")
		})
	]);
}

function findMissionStory(data: Data): string {
	const mission = record(data, "mission") as Mission | undefined;
	const description = mission ? missionDescription(mission, Date.now()) : "";
	return joinParagraphs([`${smallEventIntro()}${any("findMission.intrigue")}`, `**${description}**`]);
}

function findPetKey(data: Data): string {
	if (data.isPetReceived === true) return data.petIsReceivedByGuild === true ? "givePetGuild" : "givePetPlayer";
	return data.isPetFood === true ? "food" : "noFood";
}

function otherPlayerDetails(details: Data): Record<string, unknown> {
	const petId = num(details, "petId");
	const hasPet = Boolean(petId) && Boolean(details.petSex);
	const leagueId = num(details, "leagueId");
	const bossId = str(details, "bossId");
	return {
		level: num(details, "level"),
		...classDisplays(details),
		advice: anyTranslation("advices:advices"),
		petEmote: hasPet ? petIcon({typeId: petId!, sex: sex(details.petSex)}) : "",
		petName: hasPet ? petName({typeId: petId!, sex: sex(details.petSex), ...str(details, "petName") ? {nickname: str(details, "petName")} : {}}) : "",
		guildName: str(details, "guildName"),
		...equipmentDisplays(details),
		leagueEmoji: leagueId === undefined ? "" : icon(`leagues.${leagueId}`),
		leagueName: leagueId === undefined ? "" : i18n.t(`models:leagues.${leagueId}`),
		gloryRank: num(details, "gloryRank"),
		gems: num(details, "gems"),
		tokens: num(details, "tokens"),
		monsterName: bossId ? i18n.t(`models:monsters.${bossId}.name`) : "",
		bossLevel: num(details, "bossLevel")
	};
}

function interactOtherPlayersStory(data: Data): string {
	const pseudo = str(data, "playerName");
	const details = record(data, "data");
	if (!pseudo || !details) return any("interactOtherPlayers.no_one");
	const rank = num(details, "rank");
	const playerDisplay = t(`interactOtherPlayers.playerDisplay${rank ? "Ranked" : "Unranked"}`, {pseudo, rank});
	const interaction = str(data, "playerInteraction") ?? "";
	if (interaction === "EFFECT") {
		return any(`interactOtherPlayers.effect.${str(details, "effectId")}`, {playerDisplay});
	}
	return any(`interactOtherPlayers.${interaction.toLowerCase()}`, {playerDisplay, ...otherPlayerDetails(details)});
}

function leagueRewardKey(data: Data): string {
	if (data.rewardToday === true) return "rewardToday";
	return data.enoughFights === true ? "endMessage" : "notEnoughFight";
}

function leagueRewardStory(data: Data): string {
	const endMessage = t(`leagueReward.${leagueRewardKey(data)}`, {
		leagueId: num(data, "leagueId"),
		rewards: t("leagueReward.reward", {money: num(data, "money"), xp: num(data, "xp")}),
		time: timeUntil(num(data, "nextRewardDate") ?? Date.now())
	});
	return smallEventIntro() + any("leagueReward.intrigue") + endMessage;
}

const PET_TIME_INTERACTIONS = new Set(["gainTime", "loseTime"]);

function petStory(data: Data): string {
	const interaction = str(data, "interactionName") ?? "";
	const amount = num(data, "amount");
	const food = str(data, "food");
	return any(`pet.stories.${interaction}`, {
		context: sexContext(data.petSex),
		pet: pet(data, OWN_PET),
		amount,
		amountDisplay: amount && PET_TIME_INTERACTIONS.has(interaction) ? duration(amount) : amount,
		food: food ? `${icon(`foods.${food}`)} ${i18n.t(`models:foods.${food}`, {count: 1})}` : null,
		badge: icon("badges.legendary_pet"),
		randomAnimal: t("pet.randomAnimal", {
			context: data.randomPetSex,
			randomAnimal: pet(data, {type: "randomPetTypeId", sex: "randomPetSex"})
		})
	});
}

function smallBadStory(data: Data): string {
	const issue = str(data, "issue");
	const effectId = str(data, "effectId");
	const amount = num(data, "amount");
	const key = issue === "timeLost" && effectId ? `smallBad.${issue}.${effectId}.stories` : `smallBad.${issue}.stories`;
	return smallEventIntro() + any(key, {amount: issue === "timeLost" ? duration(amount) : amount});
}

/** The moon phase is named; every other sky event shows its number as is. */
function spaceSpecificValue(data: Data): unknown {
	const mainValue = num(record(data, "values") ?? {}, "mainValue") ?? 0;
	return str(data, "chosenEvent") === "moonPhase" ? i18n.tArray("smallEvents:space.moonPhases")[mainValue] : mainValue;
}

export function spaceSkyWatchingStory(): string {
	return t("space.before_search_format", {
		seIntro: smallEventIntro(),
		intro: any("space.intro", {name: any("space.names")}),
		searchAction: any("space.searchAction"),
		search: any("space.search")
	});
}

/** Discord posts the sky watching first and completes the same message once the result is known. */
export function spaceResultStory(data: Data, before = spaceSkyWatchingStory()): string {
	const values = record(data, "values") ?? {};
	const mainValue = num(values, "mainValue") ?? 0;
	const event = str(data, "chosenEvent");
	return t("space.after_search_format", {
		oldMessage: before,
		actionIntro: any("space.actionIntro"),
		action: any("space.action"),
		specific: any(`space.specific.${event}`, {
			mainValue: spaceSpecificValue(data),
			objectWhichWillCrossTheSky: t("space.nObjectsCrossTheSky", {count: mainValue}),
			days: t(mainValue > 1 ? "space.days_other" : "space.days_one"),
			randomObjectName: str(values, "randomObjectName"),
			randomObjectDistance: num(values, "randomObjectDistance"),
			randomObjectDiameter: num(values, "randomObjectDiameter")
		}),
		outro: any("space.outro")
	});
}

function staffMemberStory(): string {
	const members = Object.keys(i18n.tRecord("smallEvents:staffMember.members"));
	const member = members[Math.floor(Math.random() * members.length)];
	return any("staffMember.context", {pseudo: member, sentence: t(`staffMember.members.${member}`)});
}

function withIntro(key: string, options?: (data: Data) => Record<string, unknown>): StoryBuilder {
	return data => smallEventIntro() + any(key, options ? options(data) : {});
}

const STORIES: Record<string, StoryBuilder> = {
	advanceTime: withIntro("advanceTime.stories", data => ({time: num(data, "amount"), timeDisplay: duration(num(data, "amount"))})),
	altarFirstEncounter: () => smallEventIntro() + t("altar.firstEncounter"),
	bigBad: data => smallEventIntro() + (BIG_BAD_STORIES[str(data, "kind") ?? ""]?.(data) ?? ""),
	boatAdvice: () => any("boatAdvice.intro", {advice: any("boatAdvice.advices")}),
	bonusGuildPVEIsland: data => joinParagraphs([
		t(`bonusGuildPVEIsland.events.${num(data, "event")}.intro`),
		t(`bonusGuildPVEIsland.events.${num(data, "event")}.${str(data, "result")}.${str(data, "surrounding")}`, {amount: num(data, "amount"), emoteKey: str(data, "emoteKey")})
	]),
	botFacts: withIntro("botFacts.stories", data => ({
		botFact: t(`botFacts.possibleInfo.${str(data, "information")}`, {
			count: num(data, "infoNumber"), infoNumber: num(data, "infoNumber"), infoComplement: i18n.t("models:classFormat", {id: num(data, "infoComplement") ?? 0})
		})
	})),
	class: data => smallEventIntro() + any(`class.${str(data, "classKind")}.${str(data, "interactionName")}`, {amount: num(data, "amount")}),
	doNothing: () => any("doNothing.stories"),
	dwarfPetFan: dwarfPetFanStory,
	expeditionAdvice: data => (EXPEDITION_STORIES[str(data, "interactionType") ?? ""] ?? ((): string => any("expeditionAdvice.advice")))(data),
	farmer: data => smallEventIntro() + any("farmer.stories") + any(`farmer.rewards.${str(data, "interactionName")}`, {count: num(data, "amount")}),
	findItem: withIntro("findItem.stories"),
	findMaterial: findMaterialStory,
	findMission: findMissionStory,
	findPet: data => smallEventIntro() + any(`findPet.${findPetKey(data)}`, {
		context: data.petSex, pet: pet(data, {type: "petTypeID", sex: "petSex"})
	}),
	findPotion: withIntro("findPotion.stories"),
	haunted: () => any("haunted"),
	infoFight: data => any("infoFight.intro") + (data.showHandednessInfo === true
		? t(`infoFight.handednessDescription.${data.isLeftHanded === true ? "leftHanded" : "rightHanded"}`)
		: any("infoFight.fightActions")),
	interactOtherPlayers: interactOtherPlayersStory,
	leagueReward: leagueRewardStory,
	pet: petStory,
	petDropToken: withIntro("petDropToken.stories", data => ({pet: pet(data, OWN_PET), owner: str(data, "ownerName")})),
	smallBad: smallBadStory,
	spaceInitial: spaceSkyWatchingStory,
	spaceResult: spaceResultStory,
	staffMember: staffMemberStory,
	ultimateFoodMerchant: data => smallEventIntro() + any("ultimateFoodMerchant.stories")
		+ any(`ultimateFoodMerchant.rewards.${str(data, "interactionName")}`, {count: num(data, "amount"), moneyEmote: icon("unitValues.money")}),
	winEnergy: withIntro("winEnergy.stories"),
	winEnergyOnIsland: withIntro("winEnergyOnIsland.stories", data => ({energy: num(data, "amount")})),
	winGuildXP: data => any("winGuildXP.stories", {guild: str(data, "guildName")}) + t("winGuildXP.end", {xp: num(data, "amount")}),
	winHealth: withIntro("winHealth.stories", data => ({health: num(data, "amount")})),
	winPersonalXP: data => smallEventIntro() + any("winPersonalXP.stories") + t("winPersonalXP.end", {xp: num(data, "amount")})
};

/** Some small events send a packet whose name is not the one their emoji is filed under. */
const ICON_KEYS: Record<string, string> = {
	altarFirstEncounter: "altar",
	spaceInitial: "space",
	spaceResult: "space"
};

export function smallEventKey(eventName: string): string {
	return eventName
		.replace(/^SmallEvent/, "")
		.replace(/Packet$/, "")
		.replace(/^[A-Z]/, first => first.toLowerCase());
}

export function smallEventIcon(key: string): string | undefined {
	return AppIcons.getIconOrNull(`smallEvents.${ICON_KEYS[key] ?? key}`) ?? undefined;
}

/** The Discord story of an automatic small event, or null for an event Discord does not narrate. */
export function smallEventStory(key: string, data: Data): string | null {
	const story = STORIES[key];
	return story ? story(data) : null;
}
