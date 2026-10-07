import {ReactNode} from "react";
import {INN_OUTCOMES, InnOutcome as Outcome, InnRes} from "ws-packets/src/fromServer/report/InnRes";
import {AppIcons} from "@/src/AppIcons";
import {UnitIcon} from "@/src/components/UnitIcon";
import {Toast, ToastValue} from "@/src/design/Sections";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {formatMoney, formatNumber} from "@/src/display/Amounts";
import {formatTimeUntil} from "@/src/display/ItemEffects";
import {plainStory} from "@/src/display/Markdown";
import {i18n} from "@/src/translations/i18n";

const EMBLEM_SIZE = 22;
const WAITING_UNIT = "time";

type InnToast = {emblem: ReactNode; title: string; subtitle: string; value?: ToastValue};

function innEmblem(iconPath: string): ReactNode {
	const emoji = AppIcons.getIconOrNull(iconPath) ?? AppIcons.getIconOrNull("city.inn");
	return emoji ? <TwemojiIcon emoji={emoji} size={EMBLEM_SIZE} /> : null;
}

function gain(amount: number, unit: string): ToastValue {
	return {amount: i18n.t("app:inventoryActions.gain", {amount: formatNumber(amount)}), unit};
}

function innToast(outcome: Outcome): InnToast {
	switch (outcome.type) {
		case INN_OUTCOMES.MEAL:
			return {
				emblem: innEmblem("city.inn"),
				title: i18n.t("app:city.inn.meal"),
				subtitle: i18n.t("app:city.purchases.cost", {cost: formatMoney(outcome.moneySpent)}),
				value: gain(outcome.energy, "energy")
			};
		case INN_OUTCOMES.ROOM:
			return {
				emblem: innEmblem(`rooms.${outcome.roomId}`),
				title: i18n.t("app:city.inn.room"),
				subtitle: i18n.t("app:city.inn.roomDetails", {room: plainStory(i18n.t(`commands:report.city.inns.rooms.${outcome.roomId}`)), cost: formatMoney(outcome.moneySpent)}),
				value: gain(outcome.health, "health")
			};
		default:
			return {
				emblem: <UnitIcon unit={WAITING_UNIT} size={EMBLEM_SIZE} />,
				title: i18n.t(`app:city.inn.${outcome.type}`),
				subtitle: i18n.t("app:city.inn.availableIn", {time: formatTimeUntil(outcome.nextAvailableAt)})
			};
	}
}

/** What the inn just served, said in passing over the inn page the player stays on. */
export function InnOutcome({outcome, onContinue}: {outcome: InnRes; onContinue: () => void}): ReactNode {
	const toast = innToast(outcome.outcome);
	return <Toast
		emblem={toast.emblem}
		title={toast.title}
		subtitle={toast.subtitle}
		{...toast.value ? {value: toast.value} : {}}
		onDismiss={onContinue}
	/>;
}
