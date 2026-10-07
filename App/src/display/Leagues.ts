import {AppIcons} from "@/src/AppIcons";
import {i18n} from "@/src/translations/i18n";

export function leagueName(leagueId: number): string {
	return i18n.t("app:arena.leagues.name", {icon: AppIcons.getIcon(`leagues.${leagueId}`), name: i18n.t(`models:leagues.${leagueId}`)});
}
