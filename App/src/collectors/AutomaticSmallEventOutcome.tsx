import {ReactNode} from "react";
import {SmallEventResultRes} from "ws-packets/src/fromServer/smallEvents/SmallEventResultRes";
import {formatMoney, formatNumber} from "@/src/display/Amounts";
import {Button, ButtonRow, Hero, KeyValue, Notice, Panel, Screen} from "@/src/design/Primitives";
import {i18n} from "@/src/translations/i18n";

type ResultField = {label: string; value: string};
type ResultFieldResolver = (outcome: SmallEventResultRes) => ResultField | null;

function eventKey(eventName: string): string {
	return eventName
		.replace(/^SmallEvent/, "")
		.replace(/Packet$/, "")
		.replace(/^[A-Z]/, first => first.toLowerCase());
}

function numberValue(data: Record<string, unknown>, key: string): number | null {
	return typeof data[key] === "number" ? data[key] : null;
}

function stringValue(data: Record<string, unknown>, key: string): string | null {
	return typeof data[key] === "string" ? data[key] : null;
}

function amountField(eventName: string, amount: number): ResultField {
	if (eventName === "SmallEventAdvanceTimePacket") {
		return {label: i18n.t("app:adventure.automaticResults.fields.timeGained"), value: i18n.t("app:adventure.duration.minutes", {count: amount})};
	}
	if (eventName === "SmallEventWinHealthPacket") {
		return {label: i18n.t("app:adventure.event.fields.health"), value: `+${formatNumber(amount)}`};
	}
	if (eventName === "SmallEventWinPersonalXPPacket" || eventName === "SmallEventWinGuildXPPacket") {
		return {label: i18n.t("app:adventure.event.fields.experience"), value: `+${formatNumber(amount)}`};
	}
	if (eventName === "SmallEventWinEnergyOnIslandPacket") {
		return {label: i18n.t("app:adventure.event.fields.energy"), value: `+${formatNumber(amount)}`};
	}
	return {label: i18n.t("app:adventure.automaticResults.fields.amount"), value: formatNumber(amount)};
}

function amountResultField(outcome: SmallEventResultRes): ResultField | null {
	const amount = numberValue(outcome.data, "amount");
	return amount === null || amount === 0 ? null : amountField(outcome.eventName, amount);
}

function gainedMoneyField(outcome: SmallEventResultRes): ResultField | null {
	const money = numberValue(outcome.data, "money");
	return money === null || money === 0
		? null
		: {label: i18n.t("app:adventure.event.fields.money"), value: `+${formatMoney(money)}`};
}

function lostMoneyField(outcome: SmallEventResultRes): ResultField | null {
	const moneyLost = numberValue(outcome.data, "moneyLost");
	return moneyLost === null || moneyLost <= 0
		? null
		: {label: i18n.t("app:adventure.event.fields.money"), value: `-${formatMoney(moneyLost)}`};
}

function lostHealthField(outcome: SmallEventResultRes): ResultField | null {
	const lifeLost = numberValue(outcome.data, "lifeLost");
	return lifeLost === null || lifeLost <= 0
		? null
		: {label: i18n.t("app:adventure.event.fields.health"), value: `-${formatNumber(lifeLost)}`};
}

function quantityField(outcome: SmallEventResultRes): ResultField | null {
	const quantity = numberValue(outcome.data, "quantity");
	return quantity === null || quantity <= 0
		? null
		: {label: i18n.t("app:adventure.automaticResults.fields.quantity"), value: formatNumber(quantity)};
}

function experienceField(outcome: SmallEventResultRes): ResultField | null {
	const xp = numberValue(outcome.data, "xp");
	return xp === null || xp <= 0
		? null
		: {label: i18n.t("app:adventure.event.fields.experience"), value: `+${formatNumber(xp)}`};
}

function effectField(outcome: SmallEventResultRes): ResultField | null {
	const effectId = stringValue(outcome.data, "effectId");
	return effectId
		? {label: i18n.t("app:adventure.witch.fields.effect"), value: i18n.t(`error:effects.${effectId}.self`)}
		: null;
}

function materialField(outcome: SmallEventResultRes): ResultField | null {
	const materialId = stringValue(outcome.data, "materialId");
	return materialId
		? {label: i18n.t("app:adventure.choiceResults.fields.material"), value: i18n.t(`models:materials.${materialId}`)}
		: null;
}

const RESULT_FIELD_RESOLVERS: ResultFieldResolver[] = [
	amountResultField,
	gainedMoneyField,
	lostMoneyField,
	lostHealthField,
	quantityField,
	experienceField,
	effectField,
	materialField
];

function isResultField(field: ResultField | null): field is ResultField {
	return field !== null;
}

function resultFields(outcome: SmallEventResultRes): ResultField[] {
	return RESULT_FIELD_RESOLVERS.map(resolve => resolve(outcome)).filter(isResultField);
}

export function AutomaticSmallEventOutcome({outcome, onContinue}: {
	outcome: SmallEventResultRes;
	onContinue: () => void;
}): ReactNode {
	const key = eventKey(outcome.eventName);
	const fields = resultFields(outcome);
	return (
		<Screen>
			<Hero eyebrow={i18n.t("app:adventure.smallEvent.eyebrow")} title={i18n.t(`app:adventure.automaticResults.titles.${key}`, {defaultValue: i18n.t("app:adventure.automaticResults.title")})} />
			<Notice title={i18n.t(`app:adventure.automaticResults.descriptions.${key}`, {defaultValue: i18n.t("app:adventure.automaticResults.description")})} />
			{fields.length > 0 ? <Panel>{fields.map(item => <KeyValue key={item.label} {...item} />)}</Panel> : null}
			<ButtonRow><Button variant="primary" onPress={onContinue}>{i18n.t("app:adventure.smallEvent.continue")}</Button></ButtonRow>
		</Screen>
	);
}
