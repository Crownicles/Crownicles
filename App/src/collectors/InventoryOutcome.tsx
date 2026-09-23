import {ReactNode} from "react";
import {InventoryOutcome as Outcome} from "@/src/store/useInventoryOutcome";
import {UnitIcon} from "@/src/components/UnitIcon";
import {itemDisplayName} from "@/src/collectors/CollectorLabels";
import {usePlayerPseudo} from "@/src/collectors/EventOutcomeScreen";
import {plainStory} from "@/src/display/Markdown";
import {Toast, ToastValue} from "@/src/design/Sections";
import {formatNumber} from "@/src/display/Amounts";
import {effectAmount, formatDurationMinutes, itemEffect, natureUnit} from "@/src/display/ItemEffects";
import {i18n} from "@/src/translations/i18n";

const MILLISECONDS_PER_MINUTE = 60_000;
const MILLISECONDS_PER_HOUR = 60 * MILLISECONDS_PER_MINUTE;
const EMBLEM_SIZE = 22;

/** The unit the emblem wears when nothing was gained: a discarded item, or a bonus still recharging. */
const NO_GAIN_UNIT = "none";
const WAITING_UNIT = "time";

type OutcomeToast = {unit: string; title: string; subtitle: string; value?: ToastValue};

function gain(amount: string, unit: string): ToastValue {
	return {amount: i18n.t("app:inventoryActions.gain", {amount}), unit};
}

function outcomeToast(outcome: Outcome, pseudo: string): OutcomeToast {
	switch (outcome.kind) {
		case "sale": {
			const {price, item} = outcome.packet;
			return price > 0
				? {unit: "money", title: plainStory(i18n.t("commands:sell.soldMessageTitle", {pseudo})), subtitle: itemDisplayName(item), value: gain(formatNumber(price), "money")}
				: {unit: NO_GAIN_UNIT, title: plainStory(i18n.t("commands:sell.potionDestroyedTitle")), subtitle: itemDisplayName(item)};
		}
		case "cooldown": {
			const availableAt = outcome.packet.lastDailyTimestamp + outcome.packet.cooldownHours * MILLISECONDS_PER_HOUR;
			return {
				unit: WAITING_UNIT,
				title: i18n.t("app:dailyBonus.cooldown"),
				subtitle: i18n.t("app:dailyBonus.availableIn", {time: formatDurationMinutes((availableAt - Date.now()) / MILLISECONDS_PER_MINUTE)})
			};
		}
		default: {
			const {itemNature, value} = outcome.packet;
			const unit = natureUnit(itemNature);
			return {
				unit: unit ?? NO_GAIN_UNIT,
				title: i18n.t(outcome.kind === "daily" ? "app:dailyBonus.received" : "app:inventoryActions.drunk"),
				subtitle: itemEffect(itemNature, value),
				...unit ? {value: gain(effectAmount(itemNature, value), unit)} : {}
			};
		}
	}
}

/** What an inventory action just did, said in passing rather than in a window the player must close. */
export function InventoryOutcome({outcome, onContinue}: {outcome: Outcome; onContinue: () => void}): ReactNode {
	const toast = outcomeToast(outcome, usePlayerPseudo());
	return <Toast
		emblem={<UnitIcon unit={toast.unit} size={EMBLEM_SIZE} />}
		title={toast.title}
		subtitle={toast.subtitle}
		{...toast.value ? {value: toast.value} : {}}
		onDismiss={onContinue}
	/>;
}
