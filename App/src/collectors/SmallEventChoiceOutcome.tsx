import {ReactNode, useMemo} from "react";
import {
	SmallEventChoiceResult, SmallEventChoiceResultRes
} from "ws-packets/src/fromServer/smallEvents/SmallEventChoiceResultRes";
import {RecipeDisplay} from "ws-packets/src/objects/RecipeDisplay";
import {AppIcons} from "@/src/AppIcons";
import {EventOutcomeScreen} from "@/src/collectors/EventOutcomeScreen";
import {AMOUNT_UNITS} from "@/src/display/Amounts";
import {formatDurationMinutes} from "@/src/display/ItemEffects";
import {
	amountEffect, gainEffect, infoEffect, lossEffect, lostAmountEffect, presentEffects
} from "@/src/display/OutcomeEffects";
import {petShortField} from "@/src/display/PetDisplay";
import {smallEventIntro} from "@/src/display/SmallEventStories";
import type {Effect} from "@/src/design/Sections";
import {anyTranslation} from "@/src/translations/RandomTranslation";
import {i18n} from "@/src/translations/i18n";

/**
 * What a small event the player answered came to, told with the very sentences Discord posts, then
 * summed up as the changes it made.
 */

type Result<Event extends SmallEventChoiceResult["event"]> = Extract<SmallEventChoiceResult, {event: Event}>;
type OutcomeDetails = {story: string; effects: Effect[]; icon?: string};

const UNITS = {score: "score", xp: "xp", time: "time", lostHealth: "lostHealth", lostMoney: "lostMoney"} as const;

/** Some small events wear an emoji filed under another name than their result. */
const EVENT_ICON_KEYS: Partial<Record<SmallEventChoiceResult["event"], string>> = {
	interactPoor: "interactOtherPlayers",
	pveIsland: "goToPVEIsland",
	epicShop: "epicItemShop"
};

/** Recipes are sold by the farmer or by Gaspard-Jo, whose own small event lends the emoji. */
const RECIPE_SHOP_ICON_KEYS = {farmer: "farmer", gaspardJo: "ultimateFoodMerchant"} as const;

function t(key: string, options: Record<string, unknown> = {}): string {
	return i18n.t(`smallEvents:${key}`, options);
}

function any(key: string, options: Record<string, unknown> = {}): string {
	return anyTranslation(`smallEvents:${key}`, options);
}

function sexContext(isFemale: boolean): string {
	return isFemale ? "female" : "male";
}

function icon(path: string): string {
	return AppIcons.getIconOrNull(path) ?? "";
}

function label(key: string): string {
	return i18n.t(`app:adventure.choiceResults.fields.${key}`);
}

function pointsEffect(points: number): Effect | null {
	return amountEffect(i18n.t("app:adventure.event.fields.points"), points, {gain: UNITS.score});
}

function timeLostEffect(minutes: number): Effect | null {
	return minutes > 0 ? lossEffect(i18n.t("app:adventure.event.fields.timeLost"), formatDurationMinutes(minutes), {unit: UNITS.time}) : null;
}

function altarBonusText(result: Result<"altar"> & {outcome: "contributed"}): string {
	return [
		result.bonusGems > 0 ? any("altar.bonusGems", {gems: result.bonusGems, gemEmote: icon("unitValues.gem")}) : null,
		result.bonusItemGiven ? any("altar.bonusItem") : null,
		result.badgeAwarded ? t("altar.badgeAwarded") : null
	].filter(text => text !== null).map(text => `\n\n${text}`).join("");
}

function altarStory(result: Result<"altar">): string {
	const params = {amount: result.amount, moneyEmote: icon("unitValues.money"), poolAmount: result.current, poolThreshold: result.threshold};
	if (result.outcome === "notContributed") {
		return any(`altar.${result.canAfford ? "refused" : "notEnoughMoney"}`, params);
	}
	return any(`altar.${result.blessingTriggered ? "blessingTriggered" : "contributed"}`, {
		...params,
		blessingType: result.blessingTriggered ? i18n.t(`bot:blessingNames.${result.blessingType}`) : ""
	}) + altarBonusText(result);
}

function altarEffects(result: Result<"altar">): Effect[] {
	if (result.outcome === "notContributed") return [];
	return presentEffects([
		lostAmountEffect(label("contribution"), result.amount, UNITS.lostMoney),
		amountEffect(label("gems"), result.bonusGems, {gain: AMOUNT_UNITS.GEM}),
		result.blessingTriggered ? gainEffect(label("blessing"), i18n.t(`bot:blessingNames.${result.blessingType}`)) : null,
		result.bonusItemGiven ? gainEffect(label("bonusItem"), i18n.t("app:common.yes")) : null,
		result.badgeAwarded ? gainEffect(label("badge"), i18n.t("app:common.yes")) : null,
		infoEffect(label("pool"), i18n.t("app:profile.formats.progress", {value: result.current, max: result.threshold}), {unit: AMOUNT_UNITS.MONEY})
	]);
}

function badPetDetails(result: Result<"badPet">): OutcomeDetails {
	return {
		story: any(`badPet.outcomes.${result.actionId}.${result.loveLost === 0 ? "success" : "fail"}`, {
			pet: petShortField({typeId: result.petId, sex: result.sex, ...result.petNickname ? {nickname: result.petNickname} : {}}),
			context: sexContext(result.sex === "f")
		}),
		effects: presentEffects([lostAmountEffect(label("affection"), result.loveLost)])
	};
}

function cartStoryKey(result: Result<"cart">): string {
	if (result.accepted && !result.canAfford) return "notEnoughMoney";
	if (!result.accepted) return "travelRefused";
	if (result.isScam) return "scamTravelDone";
	return result.isDisplayed ? "normalTravelDone" : "unknownDestinationTravelDone";
}

function cartDetails(result: Result<"cart">): OutcomeDetails {
	const story = cartStoryKey(result);
	const scored = result.accepted && result.canAfford && result.pointsWon > 0;
	return {
		story: any(`cart.${story}`) + (scored ? t("cart.confirmedScore", {score: result.pointsWon}) : ""),
		effects: presentEffects([pointsEffect(result.pointsWon)])
	};
}

function fightPetDetails(result: Result<"fightPet">): OutcomeDetails {
	const success = result.outcome === "success";
	return {
		story: t(`fightPet.fightPetActions.${result.actionId}.${success ? "success" : "failure"}`, {context: sexContext(result.isFemale)})
			+ (success ? t("fightPet.rageUpFormat", {rageUpDescription: any("fightPet.rageUpDescriptions")}) : ""),
		effects: []
	};
}

const GARDENER_REWARDS: Record<string, (result: Result<"gardener">) => string> = {
	seed: result => any(`gardener.rewards.seed.${result.conditionKey}`, {cost: result.cost}),
	advice: result => any(`gardener.rewards.advice.${result.conditionKey}`, {
		...result.requiredLevel === undefined ? {} : {level: result.requiredLevel},
		...result.requiredMoney === undefined ? {} : {cost: result.requiredMoney}
	}),
	plant: result => any("gardener.rewards.plant", {plantId: result.plantId}),
	material: result => any("gardener.rewards.material", {materialId: result.materialId})
};

function gardenerDetails(result: Result<"gardener">): OutcomeDetails {
	const story = result.isFirstEncounter === undefined
		? ""
		: smallEventIntro() + any(`gardener.stories.${result.isFirstEncounter ? "first" : "recurring"}`);
	return {
		story: story + (GARDENER_REWARDS[result.interactionName]?.(result) ?? ""),
		effects: presentEffects([
			result.plantId > 0 && result.interactionName !== "advice" ? gainEffect(label("plant"), i18n.t(`models:plants.${result.plantId}`)) : null,
			result.materialId > 0 ? gainEffect(label("material"), i18n.t(`models:materials.${result.materialId}`)) : null,
			lostAmountEffect(label("cost"), result.cost, UNITS.lostMoney)
		])
	};
}

function pveIslandDetails(result: Result<"pveIsland">): OutcomeDetails {
	if (result.outcome === "notEnoughGems") return {story: t("goToPVEIsland.notEnoughGems"), effects: []};
	return {
		story: t(`goToPVEIsland.endStoryAccept${result.alone ? "" : "WithMember"}`, {
			gainScore: result.pointsWon > 0 ? t("goToPVEIsland.confirmedScore", {score: result.pointsWon}) : ""
		}),
		effects: presentEffects([pointsEffect(result.pointsWon)])
	};
}

function gobletMalusEffect(result: Result<"goblets">): Effect | null {
	if (result.malus === "life") return lostAmountEffect(label("health"), result.value, UNITS.lostHealth);
	if (result.malus === "time") return timeLostEffect(result.value);
	return null;
}

function gobletsDetails(result: Result<"goblets">): OutcomeDetails {
	return {
		story: t(`gobletsGame.results.${result.malus}`, {
			quantity: result.malus === "time" ? formatDurationMinutes(result.value) : result.value,
			goblet: result.goblet
		}),
		effects: presentEffects([gobletMalusEffect(result)]),
		icon: icon(`goblets.${result.goblet}`)
	};
}

function limogesOutcome(result: Result<"limoges">): string {
	if (result.outcome === "success") {
		return any("limoges.successStories", {experience: result.reward?.experience, score: result.reward?.score});
	}
	if (!result.penalty) return t("limoges.failureFallback");
	return t(`limoges.penalties.${result.penalty.type}`, {
		amount: result.penalty.amount,
		amountDisplay: result.penalty.type === "time" ? formatDurationMinutes(result.penalty.amount) : result.penalty.amount
	});
}

const LIMOGES_PENALTY_UNITS = {health: UNITS.lostHealth, money: UNITS.lostMoney, time: UNITS.time} as const;

function limogesDetails(result: Result<"limoges">): OutcomeDetails {
	const recap = t(`limoges.recap.${result.outcome}.${result.shouldHaveAccepted ? "accept" : "refuse"}`);
	return {
		story: `${recap}\n\n${limogesOutcome(result)}`,
		effects: presentEffects([
			result.reward ? amountEffect(i18n.t("app:adventure.event.fields.experience"), result.reward.experience, {gain: UNITS.xp}) : null,
			result.reward ? pointsEffect(result.reward.score) : null,
			result.penalty?.type === "time" ? timeLostEffect(result.penalty.amount) : null,
			result.penalty && result.penalty.type !== "time" ? lostAmountEffect(label(result.penalty.type), result.penalty.amount, LIMOGES_PENALTY_UNITS[result.penalty.type]) : null
		])
	};
}

const PET_FOOD_FOUND = new Set(["found_by_player", "found_by_pet", "found_anyway"]);
const PET_FOOD_SOUP_OUTCOMES = new Set([...PET_FOOD_FOUND, "pet_failed"]);
const PET_FOOD_INVESTIGATED = new Set(["found_by_player", "player_failed"]);

function petFoodLoveKey(loveChange: number): string {
	if (loveChange > 0) return "plus";
	return loveChange < 0 ? "minus" : "neutral";
}

function petFoodStory(result: Result<"petFood">): string {
	const found = PET_FOOD_FOUND.has(result.outcome);
	const context = sexContext(result.petSex === "f");
	const foodNames = found ? i18n.tArray(`smallEvents:petFood.foodNames.${result.foodType}`) : [];
	const outcomeKey = result.foodType === "soup" && PET_FOOD_SOUP_OUTCOMES.has(result.outcome) ? `${result.outcome}_soup` : result.outcome;
	const story = t(`petFood.outcomes.${outcomeKey}`, {
		context,
		foodName: foodNames.length > 0 ? foodNames[Math.floor(Math.random() * foodNames.length)] : "",
		time: PET_FOOD_INVESTIGATED.has(result.outcome) && result.timeLostMinutes ? formatDurationMinutes(result.timeLostMinutes) : ""
	});
	return found ? `${story}\n${t(`petFood.love.${petFoodLoveKey(result.loveChange)}`, {context})}` : story;
}

function petFoodDetails(result: Result<"petFood">): OutcomeDetails {
	return {
		story: petFoodStory(result),
		effects: presentEffects([amountEffect(label("affection"), result.loveChange), timeLostEffect(result.timeLostMinutes ?? 0)])
	};
}

function recipeDisplay(recipe: RecipeDisplay): string {
	return i18n.t("models:cooking.recipeDisplay", {recipeId: recipe.recipeId, recipeType: recipe.recipeType, level: recipe.level});
}

function recipeShopDetails(result: Result<"recipeShop">): OutcomeDetails {
	const shopIcon = icon(`smallEvents.${RECIPE_SHOP_ICON_KEYS[result.source]}`);
	if (result.outcome === "cannotBuy") return {story: t("recipeShop.notEnoughMoney"), effects: [], icon: shopIcon};
	const learnt = i18n.t("commands:report.city.homes.cooking.recipeDiscovered", {recipe: recipeDisplay(result.recipe)});
	return {
		story: `${learnt} (${result.recipeCost} ${icon("unitValues.money")})`,
		effects: presentEffects([
			gainEffect(label("recipe"), recipeDisplay(result.recipe)),
			lostAmountEffect(label("cost"), result.recipeCost, UNITS.lostMoney)
		]),
		icon: shopIcon
	};
}

const SHOP_STORY_KEYS = {purchased: "purchased", cannotBuy: "notEnoughMoney"} as const;
const SHOP_NAMESPACES = {shop: "shop", epicShop: "epicItemShop"} as const;

function shopDetails(result: Result<"shop" | "epicShop">): OutcomeDetails {
	return {story: any(`${SHOP_NAMESPACES[result.event]}.${SHOP_STORY_KEYS[result.outcome]}`), effects: []};
}

type DetailsBuilders = {[Event in SmallEventChoiceResult["event"]]: (result: Result<Event>) => OutcomeDetails};

const RESULT_DETAILS: DetailsBuilders = {
	altar: result => ({story: altarStory(result), effects: altarEffects(result)}),
	badPet: badPetDetails,
	cart: cartDetails,
	fightPet: fightPetDetails,
	gardener: gardenerDetails,
	pveIsland: pveIslandDetails,
	goblets: gobletsDetails,
	interactPoor: () => ({story: any("interactOtherPlayers.poor_give_money"), effects: []}),
	limoges: limogesDetails,
	petFood: petFoodDetails,
	recipeShop: recipeShopDetails,
	shop: shopDetails,
	epicShop: shopDetails
};

function resultDetails(result: SmallEventChoiceResult): OutcomeDetails {
	// TypeScript cannot tie the looked-up builder to the narrowed result of the same event.
	const build = RESULT_DETAILS[result.event] as (result: SmallEventChoiceResult) => OutcomeDetails;
	return build(result);
}

export function SmallEventChoiceOutcome({outcome, onContinue}: {
	outcome: SmallEventChoiceResultRes;
	onContinue: () => void;
}): ReactNode {
	const details = useMemo(() => resultDetails(outcome.result), [outcome.result]);
	const event = outcome.result.event;
	return <EventOutcomeScreen
		emoji={details.icon || (AppIcons.getIconOrNull(`smallEvents.${EVENT_ICON_KEYS[event] ?? event}`) ?? undefined)}
		story={details.story}
		effects={details.effects}
		continueLabel={i18n.t("app:adventure.smallEvent.continue")}
		onContinue={onContinue}
	/>;
}
