import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportMonsterRewardRes,
	CommandReportRefusePveFightRes
} from "../../../../../../Lib/src/packets/commands/CommandReportPacket";
import { ReactionCollectorCreationPacket } from "../../../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { ReactionCollectorPveFightData } from "../../../../../../Lib/src/packets/interaction/ReactionCollectorPveFight";
import { CrowniclesIcons } from "../../../../../../Lib/src/CrowniclesIcons";
import { SexTypeShort } from "../../../../../../Lib/src/constants/StringConstants";
import { DiscordCache } from "../../../../bot/DiscordCache";
import { CrowniclesEmbed } from "../../../../messages/CrowniclesEmbed";
import i18n from "../../../../translations/i18n";
import { ReactionCollectorReturnTypeOrNull } from "../../../../packetHandlers/handlers/ReactionCollectorHandlers";
import { DiscordCollectorUtils } from "../../../../utils/DiscordCollectorUtils";
import { formatMaterialLoot } from "../../../../utils/MaterialLootDisplayUtils";
import { PetUtils } from "../../../../utils/PetUtils";
import {
	escapeUsername, StringUtils
} from "../../../../utils/StringUtils";

export async function handleStartPveFight(context: PacketContext, packet: ReactionCollectorCreationPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	const data = packet.data.data as ReactionCollectorPveFightData;
	const lng = interaction.userLanguage;
	const msg = i18n.t("commands:report.pveEvent", {
		lng,
		pseudo: escapeUsername(interaction.user.displayName),
		event: i18n.t(`models:pveMapsStory.${data.mapId}.${data.monster.id}`, { lng }),
		monsterDisplay: i18n.t("commands:report.encounterMonsterStats", {
			lng,
			monsterName: i18n.t(`models:monsters.${data.monster.id}.name`, { lng }),
			emoji: CrowniclesIcons.monsters[data.monster.id],
			description: i18n.t(`models:monsters.${data.monster.id}.description`, { lng }),
			level: data.monster.level,
			energy: data.monster.energy,
			attack: data.monster.attack,
			defense: data.monster.defense,
			speed: data.monster.speed
		})
	});

	return await DiscordCollectorUtils.createAcceptRefuseCollector(interaction, msg, packet, context, {
		emojis: {
			accept: CrowniclesIcons.pveFights.startFight,
			refuse: CrowniclesIcons.pveFights.waitABit
		}
	});
}

export async function refusePveFight(_packet: CommandReportRefusePveFightRes, context: PacketContext): Promise<void> {
	const originalInteraction = DiscordCache.getInteraction(context.discord!.interaction!);
	if (!originalInteraction) {
		return;
	}
	const buttonInteraction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	await buttonInteraction?.editReply({
		content: i18n.t("commands:report.pveFightRefused", {
			lng: originalInteraction.userLanguage,
			pseudo: escapeUsername(originalInteraction.user.displayName)
		})
	});
}

export async function displayMonsterReward(
	packet: CommandReportMonsterRewardRes,
	context: PacketContext
): Promise<void> {
	const originalInteraction = DiscordCache.getInteraction(context.discord!.interaction!);
	if (!originalInteraction) {
		return;
	}

	const lng = originalInteraction.userLanguage;

	const {
		user,
		channel
	} = originalInteraction;
	const descriptionParts: string[] = [];

	descriptionParts.push(
		i18n.t("commands:report.monsterRewardsDescription", {
			lng,
			money: packet.money,
			experience: packet.experience
		})
	);

	if (packet.guildXp > 0) {
		descriptionParts.push(
			i18n.t("commands:report.monsterRewardGuildXp", {
				lng,
				guildXp: packet.guildXp
			})
		);
	}

	if (packet.guildPoints > 0) {
		descriptionParts.push(
			i18n.t("commands:report.monsterRewardsGuildPoints", {
				lng,
				guildPoints: packet.guildPoints
			})
		);
	}

	if (packet.petReaction) {
		const petDisplay = PetUtils.petToShortString(lng, packet.petReaction.petNickname, packet.petReaction.petId, packet.petReaction.petSex as SexTypeShort);
		const petReactionText = StringUtils.getRandomTranslation(`commands:fight.petReactions.${packet.petReaction.reactionType}`, lng, {
			player: escapeUsername(user.displayName),
			pet: petDisplay
		});
		descriptionParts.push(`\n${petReactionText}`);
	}

	const materialLootText = formatMaterialLoot(packet.materialLoot, lng);
	if (materialLootText) {
		descriptionParts.push(`\n${materialLootText}`);
	}

	const embed = new CrowniclesEmbed()
		.formatAuthor(
			i18n.t("commands:report.rewardEmbedTitle", {
				lng,
				pseudo: escapeUsername(user.displayName)
			}),
			user
		)
		.setDescription(descriptionParts.join("\n"));

	await channel.send({ embeds: [embed] });
}
