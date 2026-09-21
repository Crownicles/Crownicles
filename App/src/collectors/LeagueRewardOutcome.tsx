import {ReactNode} from "react";
import {LeagueRewardOutcome as Outcome} from "ws-packets/src/objects/Rankings";
import {Note} from "@/src/design/Primitives";
import {formatGlory, formatMoney, formatNumber} from "@/src/display/Amounts";
import {leagueName} from "@/src/display/Leagues";
import {missionDate} from "@/src/display/Missions";
import {i18n} from "@/src/translations/i18n";
import {ExpandableList, Fact, Sheet} from "@/src/design/Sections";

function LeagueResult({outcome}: {outcome: Outcome}): ReactNode {
	if (outcome.type === "notSunday") return <Note>{i18n.t("app:arena.leagues.nextClaim", {date: missionDate(outcome.nextSunday)})}</Note>;
	if (outcome.type !== "success") return <Note>{i18n.t(`app:arena.leagues.${outcome.type}`)}</Note>;
	return <>
		<Fact label={i18n.t("app:arena.league")} value={leagueName(outcome.oldLeagueId)} />
		<Fact label={i18n.t("app:profile.fields.rank")} value={formatNumber(outcome.rank)} />
		<Fact label={i18n.t("app:arena.glory")} value={formatGlory(outcome.gloryPoints)} />
		<Fact label={i18n.t("app:profile.fields.money")} value={formatMoney(outcome.money)} />
		<Fact label={i18n.t("app:profile.fields.experience")} value={formatNumber(outcome.xp)} />
		<Fact label={i18n.t("app:profile.fields.score")} value={formatNumber(outcome.score)} />
	</>;
}

export function LeagueRewardOutcome({outcome, onContinue}: {outcome: Outcome; onContinue: () => void}): ReactNode {
	return <Sheet
		caption={i18n.t("app:arena.eyebrow")}
		title={i18n.t("app:arena.leagues.reward")}
		closeLabel={i18n.t("app:common.back")}
		onClose={onContinue}
	>
		<ExpandableList><LeagueResult outcome={outcome} /></ExpandableList>
	</Sheet>;
}
