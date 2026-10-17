import { TournamentNotificationPacket } from "../../../../Lib/src/packets/notifications/TournamentNotificationPacket";
import { TournamentDefenseNotificationPacket } from "../../../../Lib/src/packets/notifications/TournamentDefenseNotificationPacket";
import { TournamentNotificationEvents } from "../../../../Lib/src/types/Tournament";
import { Language } from "../../../../Lib/src/Language";
import {
	dateDisplay, finishInTimeDisplay
} from "../../../../Lib/src/utils/TimeUtils";
import { DisplayUtils } from "../../utils/DisplayUtils";
import i18n from "../../translations/i18n";
import { getTournamentCategoryLabel } from "./TournamentDisplayUtils";

function getEventKey(packet: TournamentNotificationPacket): string {
	if (packet.event === TournamentNotificationEvents.ENDED && packet.cancellationReason) {
		return `cancelled.${packet.cancellationReason}`;
	}
	return packet.event;
}

export async function getTournamentNotificationContent(packet: TournamentNotificationPacket, lng: Language): Promise<string> {
	const winner = packet.winnerKeycloakId
		? await DisplayUtils.getEscapedUsername(packet.winnerKeycloakId, lng)
		: i18n.t("notifications:tournament.noWinner", { lng });
	return i18n.t(`notifications:tournament.${getEventKey(packet)}`, {
		lng,
		category: getTournamentCategoryLabel(packet.category, lng),
		combatEndsAt: dateDisplay(new Date(packet.combatEndsAt)),
		combatEndsIn: finishInTimeDisplay(new Date(packet.combatEndsAt)),
		winner,
		rank: packet.rank ?? i18n.t("notifications:tournament.unranked", { lng }),
		xp: DisplayUtils.formatNumber(packet.xp ?? 0, lng),
		money: DisplayUtils.formatNumber(packet.money ?? 0, lng),
		count: packet.itemCount ?? 0
	});
}

export async function getTournamentDefenseNotificationContent(packet: TournamentDefenseNotificationPacket, lng: Language): Promise<string> {
	return i18n.t(`notifications:tournament.defense.${packet.outcome}`, {
		lng,
		attacker: await DisplayUtils.getEscapedUsername(packet.attackerKeycloakId, lng),
		gloryChange: DisplayUtils.formatSignedNumber(packet.gloryChange, lng)
	});
}
