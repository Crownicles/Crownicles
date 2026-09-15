import {ReactNode, useEffect, useState} from "react";
import {InventoryOutcome as Outcome} from "@/src/store/useInventoryOutcome";
import {Button, ButtonRow, Confirmation} from "@/src/design/Primitives";
import {SaleOutcome} from "@/src/collectors/SellCollector";
import {formatDurationMinutes, itemEffect} from "@/src/display/ItemEffects";
import {i18n} from "@/src/translations/i18n";

const MILLISECONDS_PER_MINUTE = 60_000;
const MILLISECONDS_PER_HOUR = 60 * MILLISECONDS_PER_MINUTE;

export function InventoryOutcome({outcome, onContinue}: {outcome: Outcome; onContinue: () => void}): ReactNode {
	const [now, setNow] = useState(Date.now);
	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), MILLISECONDS_PER_MINUTE);
		return (): void => clearInterval(timer);
	}, []);
	if (outcome.kind === "sale") return <SaleOutcome outcome={outcome.packet} onContinue={onContinue} />;
	const title = outcome.kind === "cooldown" ? "app:dailyBonus.cooldown" : outcome.kind === "daily" ? "app:dailyBonus.received" : "app:inventoryActions.drunk";
	const message = outcome.kind === "cooldown"
		? i18n.t("app:dailyBonus.availableIn", {time: formatDurationMinutes((outcome.packet.lastDailyTimestamp + outcome.packet.cooldownHours * MILLISECONDS_PER_HOUR - now) / MILLISECONDS_PER_MINUTE)})
		: itemEffect(outcome.packet.itemNature, outcome.packet.value);
	return <Confirmation title={i18n.t(title)} message={message} onRequestClose={onContinue}>
		<ButtonRow><Button variant="primary" onPress={onContinue}>{i18n.t("app:sale.continue")}</Button></ButtonRow>
	</Confirmation>;
}
