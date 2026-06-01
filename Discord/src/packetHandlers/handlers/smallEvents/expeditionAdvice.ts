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

type StoryBuilder = (packet: SmallEventExpeditionAdvicePacket, lng: Language) => string;

function getPetDisplay(packet: SmallEventExpeditionAdvicePacket, lng: Language): string {
	return packet.petTypeId !== undefined
		? PetUtils.petToShortString(lng, packet.petNickname, packet.petTypeId, packet.petSex as SexTypeShort)
		: i18n.t("commands:pet.defaultPetName", { lng });
}

function buildPetConditionStory(translationKey: string): StoryBuilder {
	return (packet, lng) => StringUtils.getRandomTranslation(translationKey, lng, { pet: getPetDisplay(packet, lng) });
}

function buildSimpleStory(translationKey: string): StoryBuilder {
	return (_packet, lng) => StringUtils.getRandomTranslation(translationKey, lng);
}

function buildTalismanIntroStory(packet: SmallEventExpeditionAdvicePacket, lng: Language): string {
	const introTexts = i18n.tArray("smallEvents:expeditionAdvice.talismanIntro", { lng });
	return introTexts[packet.encounterCount! - 1] ?? introTexts[0];
}

function buildLevelTooLowStory(packet: SmallEventExpeditionAdvicePacket, lng: Language): string {
	return StringUtils.getRandomTranslation("smallEvents:expeditionAdvice.conditions.levelTooLow", lng, {
		requiredLevel: packet.requiredLevel,
		playerLevel: packet.playerLevel,
		count: packet.consolationTokensAmount
	});
}

function buildTalismanReceivedStory(packet: SmallEventExpeditionAdvicePacket, lng: Language): string {
	return StringUtils.getRandomTranslation("smallEvents:expeditionAdvice.talismanReceived", lng, {
		pet: getPetDisplay(packet, lng)
	});
}

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

function buildExpeditionBonusStory(packet: SmallEventExpeditionAdvicePacket, lng: Language): string {
	return i18n.t(getExpeditionBonusKey(packet), {
		lng,
		pet: getPetDisplay(packet, lng),
		bonusPoints: packet.bonusPoints,
		bonusMoney: packet.bonusMoney
	});
}

const STORY_BUILDERS = new Map<string, StoryBuilder>([
	[ExpeditionAdviceInteractionType.CONDITION_NOT_MET_PET_HUNGRY, buildPetConditionStory("smallEvents:expeditionAdvice.conditions.petHungry")],
	[ExpeditionAdviceInteractionType.CONDITION_NOT_MET_PET_FEISTY, buildPetConditionStory("smallEvents:expeditionAdvice.conditions.petFeisty")],
	[ExpeditionAdviceInteractionType.CONDITION_NOT_MET_PET_NOT_SEEN_BY_TALVAR, buildPetConditionStory("smallEvents:expeditionAdvice.conditions.petNotSeenByTalvar")],
	[ExpeditionAdviceInteractionType.CONDITION_NOT_MET_NO_PET, buildSimpleStory("smallEvents:expeditionAdvice.conditions.noPet")],
	[ExpeditionAdviceInteractionType.CONDITION_NOT_MET_NO_GUILD, buildSimpleStory("smallEvents:expeditionAdvice.conditions.noGuild")],
	[ExpeditionAdviceInteractionType.CONDITION_NOT_MET_LEVEL_TOO_LOW, buildLevelTooLowStory],
	[ExpeditionAdviceInteractionType.TALISMAN_INTRO, buildTalismanIntroStory],
	[ExpeditionAdviceInteractionType.TALISMAN_RECEIVED, buildTalismanReceivedStory],
	[ExpeditionAdviceInteractionType.EXPEDITION_BONUS, buildExpeditionBonusStory]
]);

const DEFAULT_STORY_BUILDER: StoryBuilder = buildSimpleStory("smallEvents:expeditionAdvice.advice");

function buildExpeditionStory(packet: SmallEventExpeditionAdvicePacket, lng: Language): string {
	const builder = STORY_BUILDERS.get(packet.interactionType) ?? DEFAULT_STORY_BUILDER;
	return builder(packet, lng);
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
