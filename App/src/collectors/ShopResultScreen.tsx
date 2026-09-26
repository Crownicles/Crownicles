import {ReactNode, useState} from "react";
import {ShopResult} from "@/src/collectors/ReportEventStore";
import {Button, ButtonRow, Note, Screen} from "@/src/design/Primitives";
import {Standing} from "@/src/design/Sections";
import {MarketAnalysis} from "@/src/collectors/MarketAnalysis";
import {petName} from "@/src/display/PetDisplay";
import {petCheckupReport} from "@/src/display/PetCheckup";
import {isShopRefusal, shopOutcomeReport} from "@/src/display/ShopReport";
import {plainLines} from "@/src/display/Markdown";
import {i18n} from "@/src/translations/i18n";

/** What the commerce answers once the player has picked something, told in its own words. */
export function ShopResultScreen({result, onContinue}: {
	result: ShopResult;
	onContinue: () => void;
}): ReactNode {
	const [now] = useState(() => Date.now());
	const continueRow = <ButtonRow><Button variant="primary" onPress={onContinue}>{i18n.t("app:city.checkup.continue")}</Button></ButtonRow>;

	if (result.kind === "noPet") {
		return (
			<Screen>
				<Standing caption={i18n.t("app:city.checkup.eyebrow")} title={i18n.t("app:city.checkup.noPet")} />
				<Note>{i18n.t("app:city.checkup.noPetDescription")}</Note>
				{continueRow}
			</Screen>
		);
	}
	if (result.kind === "checkup") {
		return (
			<Screen>
				<Standing caption={i18n.t("app:city.checkup.eyebrow")} title={petName(result.packet)} />
				<Note>{plainLines(petCheckupReport(result.packet))}</Note>
				{continueRow}
			</Screen>
		);
	}
	const refused = isShopRefusal(result.outcome);
	return (
		<Screen>
			<Standing
				caption={i18n.t("app:city.shop.result.eyebrow")}
				title={i18n.t(refused ? "app:city.shop.result.refused" : "app:city.shop.result.done")}
			/>
			{result.outcome.kind === "marketAnalysis"
				? <MarketAnalysis outcome={result.outcome} />
				: <Note>{plainLines(shopOutcomeReport(result.outcome, now))}</Note>}
			{continueRow}
		</Screen>
	);
}
