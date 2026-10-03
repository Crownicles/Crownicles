import {ReactNode, useState} from "react";
import {View} from "react-native";
import {ShopResult} from "@/src/collectors/ReportEventStore";
import {Note, Screen} from "@/src/design/Primitives";
import {ActionBanner, Standing} from "@/src/design/Sections";
import {BookOpen, Check, CircleAlert} from "@/src/design/FightIcons";
import {Story} from "@/src/design/Story";
import {Theme} from "@/src/design/Theme";
import {createStyles, useColors} from "@/src/design/ThemeContext";
import {MarketAnalysis} from "@/src/collectors/MarketAnalysis";
import {petName} from "@/src/display/PetDisplay";
import {petCheckupReport} from "@/src/display/PetCheckup";
import {isShopRefusal, shopOutcomeReport} from "@/src/display/ShopReport";
import {plainLines} from "@/src/display/Markdown";
import {i18n} from "@/src/translations/i18n";

const RESULT_EMBLEM_SIZE = 27;

const useStyles = createStyles(() => ({
	continue: {marginTop: Theme.spacing.xl}
}));

function ContinueBanner({onContinue}: {onContinue: () => void}): ReactNode {
	const styles = useStyles();
	return <View style={styles.continue}><ActionBanner icon={BookOpen} label={i18n.t("app:city.checkup.continue")} onPress={onContinue} /></View>;
}

/** What the commerce answers once the player has picked something, told in its own words. */
export function ShopResultScreen({result, onContinue}: {
	result: ShopResult;
	onContinue: () => void;
}): ReactNode {
	const [now] = useState(() => Date.now());
	const colors = useColors();

	if (result.kind === "noPet") {
		return (
			<Screen>
				<Standing caption={i18n.t("app:city.checkup.eyebrow")} title={i18n.t("app:city.checkup.noPet")} />
				<Note>{i18n.t("app:city.checkup.noPetDescription")}</Note>
				<ContinueBanner onContinue={onContinue} />
			</Screen>
		);
	}
	if (result.kind === "checkup") {
		return (
			<Screen>
				<Standing caption={i18n.t("app:city.checkup.eyebrow")} title={petName(result.packet)} />
				<Note>{plainLines(petCheckupReport(result.packet))}</Note>
				<ContinueBanner onContinue={onContinue} />
			</Screen>
		);
	}
	const refused = isShopRefusal(result.outcome);
	return (
		<Screen>
			<Standing
				emblem={refused ? <CircleAlert size={RESULT_EMBLEM_SIZE} color={colors.red} /> : <Check size={RESULT_EMBLEM_SIZE} color={colors.green} />}
				caption={i18n.t("app:city.shop.result.eyebrow")}
				title={i18n.t(refused ? "app:city.shop.result.refused" : "app:city.shop.result.done")}
			/>
			{result.outcome.kind === "marketAnalysis"
				? <MarketAnalysis outcome={result.outcome} />
				: <Story>{shopOutcomeReport(result.outcome, now)}</Story>}
			<ContinueBanner onContinue={onContinue} />
		</Screen>
	);
}
