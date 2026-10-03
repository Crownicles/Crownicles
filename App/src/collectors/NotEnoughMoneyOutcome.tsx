import {ReactNode} from "react";
import {NotEnoughMoneyRes} from "ws-packets/src/fromServer/common/NotEnoughMoneyRes";
import {Toast} from "@/src/design/Sections";
import {formatMoney} from "@/src/display/Amounts";
import {i18n} from "@/src/translations/i18n";

export function NotEnoughMoneyOutcome({outcome, onContinue}: {outcome: NotEnoughMoneyRes; onContinue: () => void}): ReactNode {
	return <Toast
		title={i18n.t("app:city.notEnoughMoney")}
		subtitle={i18n.t("app:city.locks.missingMoney", {amount: formatMoney(outcome.missingMoney)})}
		onDismiss={onContinue}
	/>;
}
