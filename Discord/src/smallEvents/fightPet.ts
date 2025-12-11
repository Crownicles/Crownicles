import { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../messages/CrowniclesSmallEventEmbed";
import { StringUtils } from "../utils/StringUtils";
import { CrowniclesIcons } from "../../../Lib/src/CrowniclesIcons";
import i18n from "../translations/i18n";
import { getRandomSmallEventIntro } from "../utils/SmallEventUtils";
import {
	ReactionCollectorFightPetPacket,
	ReactionCollectorFightPetReaction
} from "../../../Lib/src/packets/interaction/ReactionCollectorFightPet";
import {
	CrowniclesButtonReaction, CrowniclesButtonReactionMessage
} from "../messages/CrowniclesButtonReactionMessage";
import { StringConstants } from "../../../Lib/src/constants/StringConstants";
import { ReactionCollectorReturnTypeOrNull } from "../packetHandlers/handlers/ReactionCollectorHandlers";
import { Language } from "../../../Lib/src/Language";

function getFightPetReactions(baseReactions: ReactionCollectorFightPetReaction[], lng: Language): CrowniclesButtonReaction[] {
	const reactions: CrowniclesButtonReaction[] = [];
	for (const reaction of baseReactions) {
		reactions.push({
			customId: reaction.actionId,
			emote: CrowniclesIcons.fightPetActions[reaction.actionId],
			description: i18n.t(`smallEvents:fightPet.fightPetActions.${reaction.actionId}.name`, { lng })
		});
	}
	return reactions;
}

export async function fightPetCollector(context: PacketContext, packet: ReactionCollectorFightPetPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	const data = packet.data.data;
	const lng = interaction!.userLanguage;

	const formatBaseOptions = {
		lng,
		context: data.isFemale ? StringConstants.SEX.MALE.long : StringConstants.SEX.FEMALE.long
	};

	const reactions = getFightPetReactions(
		packet.reactions
			.filter((r): r is { type: string; data: ReactionCollectorFightPetReaction } => r.type === ReactionCollectorFightPetReaction.name)
			.map(r => r.data),
		lng
	);

	const embed = new CrowniclesSmallEventEmbed(
		"fightPet",
		`${getRandomSmallEventIntro(lng)}${
			StringUtils.getRandomTranslation("smallEvents:fightPet.intro", lng, {
				...formatBaseOptions,
				feralPet: i18n.t("smallEvents:fightPet.customPetDisplay", {
					...formatBaseOptions,
					petId: data.petId,
					petName: i18n.t(`models:pets.${data.petId}`, formatBaseOptions),
					adjective: StringUtils.getRandomTranslation("smallEvents:fightPet.adjectives", lng, formatBaseOptions)
				})
			})} ${StringUtils.getRandomTranslation("smallEvents:fightPet.situation", lng)}`,
		interaction.user,
		lng
	);

	return await new CrowniclesButtonReactionMessage(interaction, {
		reactions,
		embed,
		packet,
		context,
		canEndReact: true
	}).send();
}
