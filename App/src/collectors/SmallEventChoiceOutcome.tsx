import {ReactNode} from "react";
import {
	SmallEventChoiceResult, SmallEventChoiceResultRes
} from "ws-packets/src/fromServer/smallEvents/SmallEventChoiceResultRes";
import {formatAmount, formatMoney, formatNumber, AMOUNT_UNITS} from "@/src/display/Amounts";
import {Button, ButtonRow, Hero, KeyValue, Notice, Panel, Screen} from "@/src/design/Primitives";
import {i18n} from "@/src/translations/i18n";

type OutcomeField = {label: string; value: string};
type OutcomeDetails = {title: string; description: string; fields: OutcomeField[]};

function field(labelKey: string, value: string): OutcomeField {
	return {label: i18n.t(labelKey), value};
}

function altarDetails(result: Extract<SmallEventChoiceResult, {event: "altar"}>): OutcomeDetails {
	const description = result.outcome === "contributed"
		? i18n.t(result.blessingTriggered ? "app:adventure.choiceResults.altar.blessing" : "app:adventure.choiceResults.altar.contributed")
		: i18n.t(result.canAfford ? "app:adventure.choiceResults.altar.refused" : "app:adventure.choiceResults.altar.cannotAfford");
	const fields = [field("app:adventure.choiceResults.fields.pool", `${formatMoney(result.current)} / ${formatMoney(result.threshold)}`)];
	if (result.amount > 0) fields.unshift(field("app:adventure.choiceResults.fields.contribution", formatMoney(result.amount)));
	if (result.outcome === "contributed" && result.bonusGems > 0) fields.push(field("app:adventure.choiceResults.fields.gems", `+${formatAmount(result.bonusGems, AMOUNT_UNITS.GEM)}`));
	return {title: i18n.t("app:adventure.choiceResults.titles.altar"), description, fields};
}

function badPetDetails(result: Extract<SmallEventChoiceResult, {event: "badPet"}>): OutcomeDetails {
	const context = result.sex === "f" ? "female" : "male";
	const pet = result.petNickname ?? i18n.t(`models:pets.${result.petId}`, {context});
	return {
		title: i18n.t("app:adventure.choiceResults.titles.badPet"),
		description: i18n.t(result.loveLost > 0 ? "app:adventure.choiceResults.badPet.lostLove" : "app:adventure.choiceResults.badPet.safe", {pet, count: result.loveLost}),
		fields: [field("app:adventure.choiceResults.fields.action", i18n.t(`smallEvents:badPet.choices.${result.actionId}`, {context}))]
	};
}

function cartDetails(result: Extract<SmallEventChoiceResult, {event: "cart"}>): OutcomeDetails {
	const description = !result.accepted
		? i18n.t("app:adventure.choiceResults.cart.refused")
		: !result.canAfford
			? i18n.t("app:adventure.choiceResults.cart.cannotAfford")
			: i18n.t(result.isScam ? "app:adventure.choiceResults.cart.scam" : "app:adventure.choiceResults.cart.arrived");
	return {
		title: i18n.t("app:adventure.choiceResults.titles.cart"),
		description,
		fields: result.pointsWon > 0 ? [field("app:adventure.event.fields.points", `+${formatNumber(result.pointsWon)}`)] : []
	};
}

function fightPetDetails(result: Extract<SmallEventChoiceResult, {event: "fightPet"}>): OutcomeDetails {
	return {
		title: i18n.t("app:adventure.choiceResults.titles.fightPet"),
		description: i18n.t(`app:adventure.choiceResults.fightPet.${result.outcome}`),
		fields: [field("app:adventure.choiceResults.fields.action", i18n.t(`smallEvents:fightPet.fightPetActions.${result.actionId}.name`, {context: result.isFemale ? "female" : "male"}))]
	};
}

function gardenerDetails(result: Extract<SmallEventChoiceResult, {event: "gardener"}>): OutcomeDetails {
	const fields: OutcomeField[] = [];
	if (result.plantId > 0) fields.push(field("app:adventure.choiceResults.fields.plant", i18n.t(`models:plants.${result.plantId}`)));
	if (result.materialId > 0) fields.push(field("app:adventure.choiceResults.fields.material", i18n.t(`models:materials.${result.materialId}`)));
	if (result.cost > 0) fields.push(field("app:adventure.choiceResults.fields.cost", formatMoney(result.cost)));
	return {
		title: i18n.t("app:adventure.choiceResults.titles.gardener"),
		description: i18n.t(`app:adventure.choiceResults.gardener.${result.interactionName}`, {defaultValue: i18n.t("app:adventure.choiceResults.gardener.default")}),
		fields
	};
}

function pveIslandDetails(result: Extract<SmallEventChoiceResult, {event: "pveIsland"}>): OutcomeDetails {
	return result.outcome === "accepted"
		? {
			title: i18n.t("app:adventure.choiceResults.titles.pveIsland"),
			description: i18n.t(result.alone ? "app:adventure.choiceResults.pveIsland.acceptedAlone" : "app:adventure.choiceResults.pveIsland.acceptedWithGuild"),
			fields: result.pointsWon > 0 ? [field("app:adventure.event.fields.points", `+${formatNumber(result.pointsWon)}`)] : []
		}
		: {title: i18n.t("app:adventure.choiceResults.titles.pveIsland"), description: i18n.t("app:adventure.choiceResults.pveIsland.notEnoughGems"), fields: []};
}

function gobletsDetails(result: Extract<SmallEventChoiceResult, {event: "goblets"}>): OutcomeDetails {
	const quantity = result.malus === "time"
		? i18n.t("app:adventure.duration.minutes", {count: result.value})
		: formatNumber(result.value);
	return {
		title: i18n.t("app:adventure.choiceResults.titles.goblets"),
		description: i18n.t(`smallEvents:gobletsGame.results.${result.malus}`, {quantity, goblet: result.goblet}),
		fields: [field("app:adventure.choiceResults.fields.goblet", i18n.t(`smallEvents:gobletsGame.goblets.${result.goblet}.name`))]
	};
}

function limogesDetails(result: Extract<SmallEventChoiceResult, {event: "limoges"}>): OutcomeDetails {
	const fields: OutcomeField[] = [];
	if (result.reward) {
		fields.push(field("app:adventure.event.fields.experience", `+${formatNumber(result.reward.experience)}`));
		fields.push(field("app:adventure.event.fields.points", `+${formatNumber(result.reward.score)}`));
	}
	if (result.penalty) fields.push(field(`app:adventure.choiceResults.fields.${result.penalty.type}`, `-${formatNumber(result.penalty.amount)}`));
	return {title: i18n.t("app:adventure.choiceResults.titles.limoges"), description: i18n.t(`app:adventure.choiceResults.limoges.${result.outcome}`), fields};
}

function petFoodDetails(result: Extract<SmallEventChoiceResult, {event: "petFood"}>): OutcomeDetails {
	const fields: OutcomeField[] = [];
	if (result.loveChange !== 0) fields.push(field("app:adventure.choiceResults.fields.affection", `${result.loveChange > 0 ? "+" : ""}${formatNumber(result.loveChange)}`));
	if (result.timeLostMinutes) fields.push(field("app:adventure.event.fields.timeLost", i18n.t("app:adventure.duration.minutes", {count: result.timeLostMinutes})));
	return {title: i18n.t("app:adventure.choiceResults.titles.petFood"), description: i18n.t(`app:adventure.choiceResults.petFood.${result.outcome}`), fields};
}

function recipeShopDetails(result: Extract<SmallEventChoiceResult, {event: "recipeShop"}>): OutcomeDetails {
	const fields = result.outcome === "accepted"
		? [field("app:adventure.choiceResults.fields.recipe", i18n.t("models:cooking.recipeDisplay", result.recipe)), field("app:adventure.choiceResults.fields.cost", formatMoney(result.recipeCost))]
		: [];
	return {title: i18n.t("app:adventure.choiceResults.titles.recipeShop"), description: i18n.t(`app:adventure.choiceResults.recipeShop.${result.outcome}`), fields};
}

function resultDetails(result: SmallEventChoiceResult): OutcomeDetails {
	switch (result.event) {
		case "altar": return altarDetails(result);
		case "badPet": return badPetDetails(result);
		case "cart": return cartDetails(result);
		case "fightPet": return fightPetDetails(result);
		case "gardener": return gardenerDetails(result);
		case "pveIsland": return pveIslandDetails(result);
		case "goblets": return gobletsDetails(result);
		case "interactPoor": return {title: i18n.t("app:adventure.choiceResults.titles.interactPoor"), description: i18n.t("app:adventure.choiceResults.interactPoor.donated"), fields: []};
		case "limoges": return limogesDetails(result);
		case "petFood": return petFoodDetails(result);
		case "recipeShop": return recipeShopDetails(result);
		case "shop":
		case "epicShop": return {title: i18n.t(`app:adventure.choiceResults.titles.${result.event}`), description: i18n.t(`app:adventure.choiceResults.shop.${result.outcome}`), fields: []};
	}
}

export function SmallEventChoiceOutcome({outcome, onContinue}: {
	outcome: SmallEventChoiceResultRes;
	onContinue: () => void;
}): ReactNode {
	const details = resultDetails(outcome.result);
	return (
		<Screen>
			<Hero eyebrow={i18n.t("app:adventure.smallEvent.eyebrow")} title={details.title} />
			<Notice title={details.description} />
			{details.fields.length > 0 ? <Panel>{details.fields.map(item => <KeyValue key={item.label} {...item} />)}</Panel> : null}
			<ButtonRow><Button variant="primary" onPress={onContinue}>{i18n.t("app:adventure.smallEvent.continue")}</Button></ButtonRow>
		</Screen>
	);
}