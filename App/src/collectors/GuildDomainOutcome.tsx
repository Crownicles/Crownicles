import {ReactNode} from "react";
import {FromServerPacket} from "ws-packets/src/fromServer/FromServerPacket";
import {GuildDomainRes} from "ws-packets/src/fromServer/guild/GuildDomainRes";
import {GuildDomainOutcome as Outcome} from "ws-packets/src/objects/GuildDomain";
import {formatMoney, formatNumber} from "@/src/display/Amounts";
import {i18n} from "@/src/translations/i18n";
import {Toast} from "@/src/design/Sections";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {AppIcons} from "@/src/AppIcons";

const TOAST_EMBLEM_SIZE = 22;

/** Why Core turned a request down, or null when the outcome is a result worth its own sheet. */
export function domainRefusal(outcome: Outcome): string | null {
	if (outcome.type === "treasuryMissing") return i18n.t("app:guildDomain.missingTreasury", {amount: formatMoney(outcome.missingTreasury)});
	return outcome.type === "error" ? i18n.t(`app:guildDomain.errors.${outcome.error}`) : null;
}

/** The refusal a guild domain menu reads from its outcome packet. */
export function domainPacketRefusal(packet: FromServerPacket): string | null {
	return domainRefusal((packet as GuildDomainRes).outcome);
}

/** The one line that sums the change up; the domain page shows the rest as soon as it refreshes. */
function domainSummary(outcome: Outcome): string | undefined {
	const refusal = domainRefusal(outcome);
	if (refusal !== null) return refusal;
	switch (outcome.type) {
		case "notary": return i18n.t(outcome.relocated ? "app:guildDomain.relocated" : "app:guildDomain.installed");
		case "deposit": return formatMoney(outcome.treasuryDeposited);
		case "food": return `${i18n.t(`models:foods.${outcome.foodType}`, {count: outcome.amountBought})} · ${formatNumber(outcome.amountBought)}`;
		case "upgrade": return `${i18n.t(`commands:report.city.guildDomain.buildings.${outcome.building}`)} · ${i18n.t("app:guild.level", {level: outcome.newLevel})}`;
		default: return undefined;
	}
}

/** A change of the domain is acknowledged in passing: the domain page already shows the result. */
export function GuildDomainOutcome({outcome, onContinue}: {outcome: Outcome; onContinue: () => void}): ReactNode {
	const emblem = AppIcons.getIconOrNull("city.guildDomain.icon") ?? AppIcons.getIconOrNull("guild.icon");
	const subtitle = domainSummary(outcome);
	return <Toast
		{...emblem ? {emblem: <TwemojiIcon emoji={emblem} size={TOAST_EMBLEM_SIZE} />} : {}}
		title={i18n.t(`app:guildDomain.outcomes.${outcome.type}`)}
		{...subtitle ? {subtitle} : {}}
		onDismiss={onContinue}
	/>;
}
