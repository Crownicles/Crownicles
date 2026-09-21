import {ReactNode} from "react";
import {GuildDomainOutcome as Outcome} from "ws-packets/src/objects/GuildDomain";
import {Button, ButtonRow, Confirmation, Note} from "@/src/design/Primitives";
import {formatMoney, formatNumber} from "@/src/display/Amounts";
import {i18n} from "@/src/translations/i18n";
import {Fact} from "@/src/design/Sections";

function DomainResult({outcome}: {outcome: Outcome}): ReactNode {
	if (outcome.type === "notary") return <>
		<Note>{i18n.t(outcome.relocated ? "app:guildDomain.relocated" : "app:guildDomain.installed")}</Note>
		<Fact label={i18n.t("app:guildDomain.cost")} value={formatMoney(outcome.cost)} />
	</>;
	if (outcome.type === "treasuryMissing") return <Note>{i18n.t("app:guildDomain.missingTreasury", {amount: formatMoney(outcome.missingTreasury)})}</Note>;
	if (outcome.type === "error") return <Note>{i18n.t(`app:guildDomain.errors.${outcome.error}`)}</Note>;
	if (outcome.type === "deposit") return <>
		<Fact label={i18n.t("app:guildDomain.credited")} value={formatMoney(outcome.treasuryDeposited)} />
		<Fact label={i18n.t("app:city.summary.money")} value={formatMoney(outcome.newPlayerMoney)} />
		<Fact label={i18n.t("app:city.summary.treasury")} value={formatMoney(outcome.newTreasury)} />
	</>;
	if (outcome.type === "food") return <>
		<Fact label={i18n.t(`models:foods.${outcome.foodType}`, {count: outcome.amountBought})} value={formatNumber(outcome.amountBought)} />
		<Fact label={i18n.t("app:guildDomain.cost")} value={formatMoney(outcome.totalCost)} />
		<Fact label={i18n.t("app:guildDomain.stock")} value={formatNumber(outcome.newFoodStock)} />
		<Fact label={i18n.t("app:city.summary.treasury")} value={formatMoney(outcome.newTreasury)} />
	</>;
	return <>
		<Fact label={i18n.t(`commands:report.city.guildDomain.buildings.${outcome.building}`)} value={i18n.t("app:guild.level", {level: outcome.newLevel})} />
		<Fact label={i18n.t("app:guildDomain.cost")} value={formatMoney(outcome.cost)} />
		<Fact label={i18n.t("app:profile.fields.experience")} value={formatNumber(outcome.xpGained)} />
		<Fact label={i18n.t("app:city.summary.treasury")} value={formatMoney(outcome.newTreasury)} />
	</>;
}

export function GuildDomainOutcome({outcome, onContinue}: {outcome: Outcome; onContinue: () => void}): ReactNode {
	return <Confirmation title={i18n.t(`app:guildDomain.outcomes.${outcome.type}`)} onRequestClose={onContinue}>
		<DomainResult outcome={outcome} />
		<ButtonRow><Button onPress={onContinue}>{i18n.t("app:common.back")}</Button></ButtonRow>
	</Confirmation>;
}
