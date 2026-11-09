import { ReactNode } from "react";
import { AppIcons } from "@/src/AppIcons";
import { useAnnouncementTurn } from "@/src/components/useToastTurn";
import { Toast } from "@/src/design/Sections";
import { TwemojiIcon } from "@/src/design/TwemojiIcon";
import { formatNumber } from "@/src/display/Amounts";
import {
	cityStayScoreStore, useCityStayScore
} from "@/src/store/CityStayScoreStore";
import { i18n } from "@/src/translations/i18n";

const TOAST_EMBLEM_SIZE = 24;
const SCORE_UNIT = "score";

/** Says what the stay in the city just left brought, once the mission toast has had its turn. */
export function CityStayScoreToast(): ReactNode {
	const departure = useCityStayScore();
	const myTurn = useAnnouncementTurn();
	if (!departure?.cityStayScore || !myTurn) {
		return null;
	}
	return <Toast
		emblem={<TwemojiIcon emoji={AppIcons.getIcon("city.exit")} size={TOAST_EMBLEM_SIZE} />}
		title={i18n.t("app:city.stayScore.title")}
		subtitle={i18n.t("app:city.stayScore.description")}
		value={{
			amount: i18n.t("app:inventoryActions.gain", { amount: formatNumber(departure.cityStayScore) }), unit: SCORE_UNIT
		}}
		onDismiss={cityStayScoreStore.announced}
	/>;
}
