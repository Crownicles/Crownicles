import { CrowniclesIcons } from "../../../Lib/src/CrowniclesIcons";
import { Language } from "../../../Lib/src/Language";
import {
	SmallEventBonusGuildPVEIslandEmote, SmallEventBonusGuildPVEIslandPacket
} from "../../../Lib/src/packets/smallEvents/SmallEventBonusGuildPVEIslandPacket";
import i18n from "../translations/i18n";

const RESULT_EMOTES = [
	CrowniclesIcons.unitValues.energy,
	...Object.values(SmallEventBonusGuildPVEIslandEmote).map(emoteKey => CrowniclesIcons.unitValues[emoteKey])
];

export function buildBonusGuildPVEIslandDescription(packet: SmallEventBonusGuildPVEIslandPacket, lng: Language): string {
	const resultDescription = i18n.t(`smallEvents:bonusGuildPVEIsland.events.${packet.event}.${packet.result}.${packet.surrounding}`, {
		lng,
		amount: packet.amount,
		emoteKey: packet.emoteKey
	});
	const expectedEmote = CrowniclesIcons.unitValues[packet.emoteKey];
	const normalizedDescription = RESULT_EMOTES
		.reduce((description, emote) => description.replace(emote, expectedEmote), resultDescription);

	return `${i18n.t(`smallEvents:bonusGuildPVEIsland.events.${packet.event}.intro`, { lng })}\n\n${normalizedDescription}`;
}
