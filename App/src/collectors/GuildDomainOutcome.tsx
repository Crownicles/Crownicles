import {ReactNode} from "react";
import {FromServerPacket} from "ws-packets/src/fromServer/FromServerPacket";
import {GuildDomainRes} from "ws-packets/src/fromServer/guild/GuildDomainRes";
import {GuildDomainOutcome as Outcome} from "ws-packets/src/objects/GuildDomain";
import {Note} from "@/src/design/Primitives";
import {formatMoney, formatNumber} from "@/src/display/Amounts";
import {i18n} from "@/src/translations/i18n";
import {ExpandableList, Fact, Sheet} from "@/src/design/Sections";

/** Why Core turned a request down, or null when the outcome is a result worth its own sheet. */
export function domainRefusal(outcome: Outcome): string | null {
	if (outcome.type === "treasuryMissing") return i18n.t("app:guildDomain.missingTreasury", {amount: formatMoney(outcome.missingTreasury)});
	return outcome.type === "error" ? i18n.t(`app:guildDomain.errors.${outcome.error}`) : null;
}

/** The refusal a guild domain menu reads from its outcome packet. */
export function domainPacketRefusal(packet: FromServerPacket): string | null {
	return domainRefusal((packet as GuildDomainRes).outcome);
}

function DomainResult({outcome}: {outcome: Outcome}): ReactNode {
	const refusal = domainRefusal(outcome);
	if (refusal !== null) return <Note>{refusal}</Note>;
	if (outcome.type === "notary") return <>
		<Note>{i18n.t(outcome.relocated ? "app:guildDomain.relocated" : "app:guildDomain.installed")}</Note>
		<Fact label={i18n.t("app:guildDomain.cost")} value={formatMoney(outcome.cost)} />
	</>;
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
	if (outcome.type !== "upgrade") return null;
	return <>
		<Fact label={i18n.t(`commands:report.city.guildDomain.buildings.${outcome.building}`)} value={i18n.t("app:guild.level", {level: outcome.newLevel})} />
		<Fact label={i18n.t("app:guildDomain.cost")} value={formatMoney(outcome.cost)} />
		<Fact label={i18n.t("app:profile.fields.experience")} value={formatNumber(outcome.xpGained)} />
		<Fact label={i18n.t("app:city.summary.treasury")} value={formatMoney(outcome.newTreasury)} />
	</>;
}

export function GuildDomainOutcome({outcome, onContinue}: {outcome: Outcome; onContinue: () => void}): ReactNode {
	return <Sheet
		caption={i18n.t("app:guild.pages.domain")}
		title={i18n.t(`app:guildDomain.outcomes.${outcome.type}`)}
		closeLabel={i18n.t("app:common.back")}
		onClose={onContinue}
	>
		<ExpandableList><DomainResult outcome={outcome} /></ExpandableList>
	</Sheet>;
}
