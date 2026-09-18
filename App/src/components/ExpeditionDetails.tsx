import {ReactNode} from "react";
import {ExpeditionFood, ExpeditionOption, ExpeditionProgress, ExpeditionRewards} from "ws-packets/src/objects/PetExpedition";
import {KeyValue, Note, Panel, Row, StatBar} from "@/src/design/Primitives";
import {Theme} from "@/src/design/Theme";
import {expeditionLocationName, expeditionPetName, expeditionRisk} from "@/src/display/PetExpedition";
import {formatDurationMinutes} from "@/src/display/ItemEffects";
import {formatMoney, formatNumber} from "@/src/display/Amounts";
import {missionDate} from "@/src/display/Missions";
import {useSecondsLeft} from "@/src/collectors/CollectorPrompt";
import {i18n} from "@/src/translations/i18n";

const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1000;

export function ExpeditionFoodDetails({amount, details}: {amount?: number; details?: ExpeditionFood[]}): ReactNode {
	return <>
		{amount !== undefined ? <KeyValue label={i18n.t("app:expedition.foodConsumed")} value={formatNumber(amount)} /> : null}
		{details?.map(food => <KeyValue key={food.foodType} label={i18n.t(`models:foods.${food.foodType}`, {count: food.amount})} value={formatNumber(food.amount)} />)}
	</>;
}

export function ExpeditionOptionDetails({option}: {option: ExpeditionOption}): ReactNode {
	return <Panel>
		<KeyValue label={i18n.t("app:expedition.destination")} value={expeditionLocationName(option)} />
		<KeyValue label={i18n.t("app:expedition.duration")} value={formatDurationMinutes(option.displayDurationMinutes)} />
		<KeyValue label={i18n.t("app:expedition.risk")} value={expeditionRisk(option.riskCategory)} />
		<KeyValue label={i18n.t("app:expedition.terrain")} value={i18n.t(`commands:petExpedition.terrainCategories.${option.difficultyCategory}`)} />
		<KeyValue label={i18n.t("app:expedition.rewards")} value={i18n.t(`commands:petExpedition.rewardCategories.${option.rewardCategory}`)} />
		<KeyValue label={i18n.t("app:expedition.foodCost")} value={formatNumber(option.foodCost)} />
		{option.hasCloneTalismanBonus ? <Note>{i18n.t("app:expedition.cloneBonus")}</Note> : null}
		{option.hasBonusTokens ? <Note>{i18n.t("app:expedition.tokenBonus")}</Note> : null}
	</Panel>;
}

export function ExpeditionProgressDetails({data}: {data: ExpeditionProgress}): ReactNode {
	const secondsLeft = useSecondsLeft(data.returnTime);
	const duration = data.startTime === undefined ? null : data.returnTime - data.startTime;
	return <Panel>
		<KeyValue label={i18n.t("app:profile.titles.pet")} value={expeditionPetName(data.pet)} />
		<KeyValue label={i18n.t("app:expedition.destination")} value={expeditionLocationName(data)} />
		<KeyValue label={i18n.t("app:expedition.risk")} value={expeditionRisk(data.riskCategory)} />
		<KeyValue label={i18n.t("app:expedition.returnAt")} value={missionDate(data.returnTime)} />
		{duration ? <StatBar label={i18n.t("app:expedition.remaining")} value={formatDurationMinutes(secondsLeft / SECONDS_PER_MINUTE)} ratio={1 - secondsLeft * MILLISECONDS_PER_SECOND / duration} color={Theme.colors.green} /> : null}
		{data.durationMinutes !== undefined ? <KeyValue label={i18n.t("app:expedition.duration")} value={formatDurationMinutes(data.durationMinutes)} /> : null}
		<ExpeditionFoodDetails amount={data.foodConsumed} details={data.foodConsumedDetails} />
	</Panel>;
}

export function ExpeditionRewardDetails({rewards}: {rewards: ExpeditionRewards}): ReactNode {
	return <>
		<Panel>
			<KeyValue label={i18n.t("app:profile.fields.money")} value={formatMoney(rewards.money)} />
			<KeyValue label={i18n.t("app:profile.fields.experience")} value={formatNumber(rewards.experience)} />
			<KeyValue label={i18n.t("app:profile.fields.score")} value={formatNumber(rewards.points)} />
			{rewards.tokens !== undefined ? <KeyValue label={i18n.t("app:profile.fields.tokens")} value={formatNumber(rewards.tokens)} /> : null}
			{rewards.materialLoot?.map(material => <KeyValue key={material.materialId} label={i18n.t(`models:materials.${material.materialId}`)} value={formatNumber(material.quantity)} />)}
		</Panel>
		{rewards.cloneTalismanFound ? <Row title={i18n.t("app:expedition.cloneFound")} /> : null}
		{rewards.itemGiven ? <Row title={i18n.t("app:expedition.itemFound")} /> : null}
	</>;
}