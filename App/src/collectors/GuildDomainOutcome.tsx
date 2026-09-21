import {ReactNode} from "react";
import {GuildDomainOutcome as Outcome} from "ws-packets/src/objects/GuildDomain";
import {Button, ButtonRow, Confirmation, KeyValue, Note} from "@/src/design/Primitives";
import {formatMoney, formatNumber} from "@/src/display/Amounts";
import {i18n} from "@/src/translations/i18n";

function DomainResult({outcome}: {outcome: Outcome}): ReactNode {
	if (outcome.type === "notary") return <>
		<Note>{i18n.t(outcome.relocated ? "app:guildDomain.relocated" : "app:guildDomain.installed")}</Note>
		<KeyValue label={i18n.t("app:guildDomain.cost")} value={formatMoney(outcome.cost)} />
	</>;
	if (outcome.type === "treasuryMissing") return <Note>{i18n.t("app:guildDomain.missingTreasury", {amount: formatMoney(outcome.missingTreasury)})}</Note>;
	if (outcome.type === "error") return <Note>{i18n.t(`app:guildDomain.errors.${outcome.error}`)}</Note>;
	if (outcome.type === "deposit") return <>
		<KeyValue label={i18n.t("app:guildDomain.credited")} value={formatMoney(outcome.treasuryDeposited)} />
		<KeyValue label={i18n.t("app:city.summary.money")} value={formatMoney(outcome.newPlayerMoney)} />
		<KeyValue label={i18n.t("app:city.summary.treasury")} value={formatMoney(outcome.newTreasury)} />
	</>;
	if (outcome.type === "food") return <>
		<KeyValue label={i18n.t(`models:foods.${outcome.foodType}`, {count: outcome.amountBought})} value={formatNumber(outcome.amountBought)} />
		<KeyValue label={i18n.t("app:guildDomain.cost")} value={formatMoney(outcome.totalCost)} />
		<KeyValue label={i18n.t("app:guildDomain.stock")} value={formatNumber(outcome.newFoodStock)} />
		<KeyValue label={i18n.t("app:city.summary.treasury")} value={formatMoney(outcome.newTreasury)} />
	</>;
	return <>
		<KeyValue label={i18n.t(`commands:report.city.guildDomain.buildings.${outcome.building}`)} value={i18n.t("app:guild.level", {level: outcome.newLevel})} />
		<KeyValue label={i18n.t("app:guildDomain.cost")} value={formatMoney(outcome.cost)} />
		<KeyValue label={i18n.t("app:profile.fields.experience")} value={formatNumber(outcome.xpGained)} />
		<KeyValue label={i18n.t("app:city.summary.treasury")} value={formatMoney(outcome.newTreasury)} />
	</>;
}

export function GuildDomainOutcome({outcome, onContinue}: {outcome: Outcome; onContinue: () => void}): ReactNode {
	return <Confirmation title={i18n.t(`app:guildDomain.outcomes.${outcome.type}`)} onRequestClose={onContinue}>
		<DomainResult outcome={outcome} />
		<ButtonRow><Button onPress={onContinue}>{i18n.t("app:common.back")}</Button></ButtonRow>
	</Confirmation>;
}
