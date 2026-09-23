import {ReactNode, useMemo} from "react";
import {SmallEventResultData, SmallEventResultRes} from "ws-packets/src/fromServer/smallEvents/SmallEventResultRes";
import {AppIcons} from "@/src/AppIcons";
import {EventOutcomeScreen} from "@/src/collectors/EventOutcomeScreen";
import {formatNumber} from "@/src/display/Amounts";
import {formatDurationMinutes} from "@/src/display/ItemEffects";
import {materialName} from "@/src/display/Resources";
import {
	amountEffect, gainEffect, lossEffect, lostAmountEffect, presentEffects
} from "@/src/display/OutcomeEffects";
import {smallEventIcon, smallEventKey, smallEventStory} from "@/src/display/SmallEventStories";
import type {Effect} from "@/src/design/Sections";
import {i18n} from "@/src/translations/i18n";

type EffectsBuilder = (data: SmallEventResultData) => (Effect | null)[];

function num(data: SmallEventResultData, key: string): number {
	const value = data[key];
	return typeof value === "number" ? value : 0;
}

function field(key: string): string {
	return i18n.t(`app:adventure.event.fields.${key}`);
}

function alteration(effectId: unknown): Effect | null {
	if (typeof effectId !== "string") return null;
	const emoji = AppIcons.getIconOrNull(`effects.${effectId}`);
	return lossEffect(i18n.t("app:adventure.witch.fields.effect"), i18n.t(`error:effects.${effectId}.self`), emoji ? {emoji} : {});
}

function timeLost(minutes: number): Effect | null {
	return minutes > 0 ? lossEffect(field("timeLost"), formatDurationMinutes(minutes), {unit: "time"}) : null;
}

const BIG_BAD_EFFECTS: Record<string, EffectsBuilder> = {
	LIFE_LOSS: data => [lostAmountEffect(field("health"), num(data, "lifeLost"), "lostHealth")],
	ALTERATION: data => [alteration(data.effectId)],
	MONEY_LOSS: data => [lostAmountEffect(field("money"), num(data, "moneyLost"), "lostMoney")]
};

const SMALL_BAD_EFFECTS: Record<string, EffectsBuilder> = {
	healthLost: data => [lostAmountEffect(field("health"), num(data, "amount"), "lostHealth")],
	moneyLost: data => [lostAmountEffect(field("money"), num(data, "amount"), "lostMoney")],
	timeLost: data => [timeLost(num(data, "amount"))]
};

/** What each automatic small event did to the player, read from the fields its own packet defines. */
const EFFECTS: Record<string, EffectsBuilder> = {
	advanceTime: data => [gainEffect(i18n.t("app:adventure.automaticResults.fields.timeGained"), formatDurationMinutes(num(data, "amount")), {unit: "timeGain"})],
	bigBad: data => BIG_BAD_EFFECTS[String(data.kind)]?.(data) ?? [],
	smallBad: data => SMALL_BAD_EFFECTS[String(data.issue)]?.(data) ?? [],
	dwarfPetFan: data => [amountEffect(field(data.isGemReward === true ? "gems" : "money"), num(data, "amount"), {gain: data.isGemReward === true ? "gem" : "money"})],
	expeditionAdvice: data => [
		amountEffect(field("points"), num(data, "bonusPoints"), {gain: "score"}),
		amountEffect(field("money"), num(data, "bonusMoney"), {gain: "money"}),
		data.consolationTokenGiven === true ? amountEffect(field("tokens"), num(data, "consolationTokensAmount"), {gain: "token"}) : null
	],
	findMaterial: data => [gainEffect(i18n.t("app:adventure.choiceResults.fields.material"), `${formatNumber(num(data, "quantity"))} × ${materialName(Number(data.materialId))}`)],
	winHealth: data => [amountEffect(field("health"), num(data, "amount"), {gain: "health"})],
	winPersonalXP: data => [amountEffect(field("experience"), num(data, "amount"), {gain: "xp"})],
	winGuildXP: data => [amountEffect(field("experience"), num(data, "amount"), {gain: "xp"})],
	winEnergyOnIsland: data => [amountEffect(field("energy"), num(data, "amount"), {gain: "energy"})]
};

export function AutomaticSmallEventOutcome({outcome, onContinue}: {
	outcome: SmallEventResultRes;
	onContinue: () => void;
}): ReactNode {
	const key = smallEventKey(outcome.eventName);
	const story = useMemo(
		() => smallEventStory(key, outcome.data) ?? i18n.t("app:adventure.automaticResults.description"),
		[key, outcome.data]
	);
	return <EventOutcomeScreen
		emoji={smallEventIcon(key)}
		story={story}
		effects={presentEffects(EFFECTS[key]?.(outcome.data) ?? [])}
		continueLabel={i18n.t("app:adventure.smallEvent.continue")}
		onContinue={onContinue}
	/>;
}
