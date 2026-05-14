import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../../../messages/CrowniclesSmallEventEmbed";
import { StringUtils } from "../../../utils/StringUtils";
import i18n from "../../../translations/i18n";
import { SexTypeShort } from "../../../../../Lib/src/constants/StringConstants";
import { PetUtils } from "../../../utils/PetUtils";
import {
	SmallEventExpeditionAdvicePacket, ExpeditionAdviceInteractionType
} from "../../../../../Lib/src/packets/smallEvents/SmallEventExpeditionAdvicePacket";

export default class ExpeditionAdviceSmallEventHandler {
	@packetHandler(SmallEventExpeditionAdvicePacket)
	async smallEventExpeditionAdvice(context: PacketContext, packet: SmallEventExpeditionAdvicePacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const lng = interaction.userLanguage;

		let story: string;

		switch (packet.interactionType) {
			case ExpeditionAdviceInteractionType.TALISMAN_INTRO: {
				// Talisman introduction (first 2 encounters, displayed in order)
				const introTexts = i18n.tArray("smallEvents:expeditionAdvice.talismanIntro", {
					lng
				});
				story = introTexts[packet.encounterCount! - 1] ?? introTexts[0];
				break;
			}

			case ExpeditionAdviceInteractionType.CONDITION_NOT_MET_NO_PET:
				story = StringUtils.getRandomTranslation("smallEvents:expeditionAdvice.conditions.noPet", lng);
				break;

			case ExpeditionAdviceInteractionType.CONDITION_NOT_MET_PET_HUNGRY: {
				const petDisplayHungry = packet.petTypeId !== undefined
					? PetUtils.petToShortString(lng, packet.petNickname, packet.petTypeId, packet.petSex as SexTypeShort)
					: i18n.t("commands:pet.defaultPetName", { lng });
				story = StringUtils.getRandomTranslation("smallEvents:expeditionAdvice.conditions.petHungry", lng, {
					pet: petDisplayHungry
				});
				break;
			}

			case ExpeditionAdviceInteractionType.CONDITION_NOT_MET_PET_FEISTY: {
				const petDisplayFeisty = packet.petTypeId !== undefined
					? PetUtils.petToShortString(lng, packet.petNickname, packet.petTypeId, packet.petSex as SexTypeShort)
					: i18n.t("commands:pet.defaultPetName", { lng });
				story = StringUtils.getRandomTranslation("smallEvents:expeditionAdvice.conditions.petFeisty", lng, {
					pet: petDisplayFeisty
				});
				break;
			}

			case ExpeditionAdviceInteractionType.CONDITION_NOT_MET_PET_NOT_SEEN_BY_TALVAR: {
				const petDisplayTalvar = packet.petTypeId !== undefined
					? PetUtils.petToShortString(lng, packet.petNickname, packet.petTypeId, packet.petSex as SexTypeShort)
					: i18n.t("commands:pet.defaultPetName", { lng });
				story = StringUtils.getRandomTranslation("smallEvents:expeditionAdvice.conditions.petNotSeenByTalvar", lng, {
					pet: petDisplayTalvar
				});
				break;
			}

			case ExpeditionAdviceInteractionType.CONDITION_NOT_MET_NO_GUILD:
				story = StringUtils.getRandomTranslation("smallEvents:expeditionAdvice.conditions.noGuild", lng);
				break;

			case ExpeditionAdviceInteractionType.CONDITION_NOT_MET_LEVEL_TOO_LOW:
				story = StringUtils.getRandomTranslation("smallEvents:expeditionAdvice.conditions.levelTooLow", lng, {
					requiredLevel: packet.requiredLevel,
					playerLevel: packet.playerLevel,
					count: packet.consolationTokensAmount
				});
				break;

			case ExpeditionAdviceInteractionType.TALISMAN_RECEIVED: {
				const petDisplayReceived = packet.petTypeId !== undefined
					? PetUtils.petToShortString(lng, packet.petNickname, packet.petTypeId, packet.petSex as SexTypeShort)
					: i18n.t("commands:pet.defaultPetName", { lng });
				story = StringUtils.getRandomTranslation("smallEvents:expeditionAdvice.talismanReceived", lng, {
					pet: petDisplayReceived
				});
				break;
			}

			case ExpeditionAdviceInteractionType.EXPEDITION_BONUS: {
				const petDisplayBonus = packet.petTypeId !== undefined
					? PetUtils.petToShortString(lng, packet.petNickname, packet.petTypeId, packet.petSex as SexTypeShort)
					: i18n.t("commands:pet.defaultPetName", { lng });

				// Determine which translation to use based on rewards
				let translationKey: string;
				if (packet.bonusCombatPotion) {
					translationKey = "smallEvents:expeditionAdvice.expeditionBonus.combatPotion";
				}
				else if (packet.bonusItem) {
					translationKey = "smallEvents:expeditionAdvice.expeditionBonus.pointsAndItem";
				}
				else if (packet.bonusMoney) {
					translationKey = "smallEvents:expeditionAdvice.expeditionBonus.pointsAndMoney";
				}
				else {
					translationKey = "smallEvents:expeditionAdvice.expeditionBonus.points";
				}

				story = i18n.t(translationKey, {
					lng,
					pet: petDisplayBonus,
					bonusPoints: packet.bonusPoints,
					bonusMoney: packet.bonusMoney
				});
				break;
			}

			case ExpeditionAdviceInteractionType.ADVICE:
			default:
				story = StringUtils.getRandomTranslation("smallEvents:expeditionAdvice.advice", lng);
				break;
		}

		await interaction.editReply({
			embeds: [new CrowniclesSmallEventEmbed("expeditionAdvice", story, interaction.user, lng)]
		});
	}
}
