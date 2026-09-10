import {ReactNode} from "react";
import {SmallEventResultRes} from "ws-packets/src/fromServer/smallEvents/SmallEventResultRes";
import {formatMoney, formatNumber} from "@/src/display/Amounts";
import {Button, ButtonRow, Hero, KeyValue, Notice, Panel, Screen} from "@/src/design/Primitives";
import {i18n} from "@/src/translations/i18n";

type ResultField = {label: string; value: string};

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

function resultFields(outcome: SmallEventResultRes): ResultField[] {
	const {data, eventName} = outcome;
	const fields: ResultField[] = [];
	const amount = numberValue(data, "amount");
	if (amount !== null && amount !== 0) fields.push(amountField(eventName, amount));
	const money = numberValue(data, "money");
	if (money !== null && money !== 0) fields.push({label: i18n.t("app:adventure.event.fields.money"), value: `+${formatMoney(money)}`});
	const moneyLost = numberValue(data, "moneyLost");
	if (moneyLost !== null && moneyLost > 0) fields.push({label: i18n.t("app:adventure.event.fields.money"), value: `-${formatMoney(moneyLost)}`});
	const lifeLost = numberValue(data, "lifeLost");
	if (lifeLost !== null && lifeLost > 0) fields.push({label: i18n.t("app:adventure.event.fields.health"), value: `-${formatNumber(lifeLost)}`});
	const quantity = numberValue(data, "quantity");
	if (quantity !== null && quantity > 0) fields.push({label: i18n.t("app:adventure.automaticResults.fields.quantity"), value: formatNumber(quantity)});
	const xp = numberValue(data, "xp");
	if (xp !== null && xp > 0) fields.push({label: i18n.t("app:adventure.event.fields.experience"), value: `+${formatNumber(xp)}`});
	const effectId = stringValue(data, "effectId");
	if (effectId) fields.push({label: i18n.t("app:adventure.witch.fields.effect"), value: i18n.t(`error:effects.${effectId}.self`)});
	const materialId = stringValue(data, "materialId");
	if (materialId) fields.push({label: i18n.t("app:adventure.choiceResults.fields.material"), value: i18n.t(`models:materials.${materialId}`)});
	return fields;
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
