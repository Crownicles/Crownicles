import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../../../messages/CrowniclesSmallEventEmbed";
import { StringUtils } from "../../../utils/StringUtils";
import i18n from "../../../translations/i18n";
import { SexTypeShort } from "../../../../../Lib/src/constants/StringConstants";
import { PetUtils } from "../../../utils/PetUtils";
import { Language } from "../../../../../Lib/src/Language";
import {
	SmallEventExpeditionAdvicePacket, ExpeditionAdviceInteractionType
} from "../../../../../Lib/src/packets/smallEvents/SmallEventExpeditionAdvicePacket";

function getPetDisplay(packet: SmallEventExpeditionAdvicePacket, lng: Language): string {
	return packet.petTypeId !== undefined
		? PetUtils.petToShortString(lng, packet.petNickname, packet.petTypeId, packet.petSex as SexTypeShort)
		: i18n.t("commands:pet.defaultPetName", { lng });
}

const PET_CONDITION_KEYS = new Map<string, string>([
	[ExpeditionAdviceInteractionType.CONDITION_NOT_MET_PET_HUNGRY, "smallEvents:expeditionAdvice.conditions.petHungry"],
	[ExpeditionAdviceInteractionType.CONDITION_NOT_MET_PET_FEISTY, "smallEvents:expeditionAdvice.conditions.petFeisty"],
	[ExpeditionAdviceInteractionType.CONDITION_NOT_MET_PET_NOT_SEEN_BY_TALVAR, "smallEvents:expeditionAdvice.conditions.petNotSeenByTalvar"]
]);

function getExpeditionBonusKey(packet: SmallEventExpeditionAdvicePacket): string {
	if (packet.bonusCombatPotion) {
		return "smallEvents:expeditionAdvice.expeditionBonus.combatPotion";
	}
	if (packet.bonusItem) {
		return "smallEvents:expeditionAdvice.expeditionBonus.pointsAndItem";
	}
	if (packet.bonusMoney) {
		return "smallEvents:expeditionAdvice.expeditionBonus.pointsAndMoney";
	}
	return "smallEvents:expeditionAdvice.expeditionBonus.points";
}

function buildExpeditionStory(packet: SmallEventExpeditionAdvicePacket, lng: Language): string {
	const petConditionKey = PET_CONDITION_KEYS.get(packet.interactionType);
	if (petConditionKey) {
		return StringUtils.getRandomTranslation(petConditionKey, lng, { pet: getPetDisplay(packet, lng) });
	}

	switch (packet.interactionType) {
		case ExpeditionAdviceInteractionType.TALISMAN_INTRO: {
			const introTexts = i18n.tArray("smallEvents:expeditionAdvice.talismanIntro", { lng });
			return introTexts[packet.encounterCount! - 1] ?? introTexts[0];
		}
		case ExpeditionAdviceInteractionType.CONDITION_NOT_MET_NO_PET:
			return StringUtils.getRandomTranslation("smallEvents:expeditionAdvice.conditions.noPet", lng);
		case ExpeditionAdviceInteractionType.CONDITION_NOT_MET_NO_GUILD:
			return StringUtils.getRandomTranslation("smallEvents:expeditionAdvice.conditions.noGuild", lng);
		case ExpeditionAdviceInteractionType.CONDITION_NOT_MET_LEVEL_TOO_LOW:
			return StringUtils.getRandomTranslation("smallEvents:expeditionAdvice.conditions.levelTooLow", lng, {
				requiredLevel: packet.requiredLevel,
				playerLevel: packet.playerLevel,
				count: packet.consolationTokensAmount
			});
		case ExpeditionAdviceInteractionType.TALISMAN_RECEIVED:
			return StringUtils.getRandomTranslation("smallEvents:expeditionAdvice.talismanReceived", lng, {
				pet: getPetDisplay(packet, lng)
			});
		case ExpeditionAdviceInteractionType.EXPEDITION_BONUS:
			return i18n.t(getExpeditionBonusKey(packet), {
				lng,
				pet: getPetDisplay(packet, lng),
				bonusPoints: packet.bonusPoints,
				bonusMoney: packet.bonusMoney
			});
		case ExpeditionAdviceInteractionType.ADVICE:
		default:
			return StringUtils.getRandomTranslation("smallEvents:expeditionAdvice.advice", lng);
	}
}

export default class ExpeditionAdviceSmallEventHandler {
	@packetHandler(SmallEventExpeditionAdvicePacket)
	async smallEventExpeditionAdvice(context: PacketContext, packet: SmallEventExpeditionAdvicePacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const lng = interaction.userLanguage;
		const story = buildExpeditionStory(packet, lng);
		await interaction.editReply({
			embeds: [new CrowniclesSmallEventEmbed("expeditionAdvice", story, interaction.user, lng)]
		});
	}
}
