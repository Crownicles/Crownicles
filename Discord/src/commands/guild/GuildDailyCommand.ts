import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandGuildDailyPacketReq,
	CommandGuildDailyRewardPacket
} from "../../../../Lib/src/packets/commands/CommandGuildDailyPacket";
import { ICommand } from "../ICommand";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import { SlashCommandBuilder } from "@discordjs/builders";
import i18n from "../../translations/i18n";
import { Language } from "../../../../Lib/src/Language";
import { DisplayUtils } from "../../utils/DisplayUtils";
import { DiscordCache } from "../../bot/DiscordCache";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import { StringConstants } from "../../../../Lib/src/constants/StringConstants";

function getPacket(): CommandGuildDailyPacketReq {
	return makePacket(CommandGuildDailyPacketReq, {});
}

function manageGivenReward(rewardKey: string, quantity: number | undefined, lng: Language): string {
	return quantity
		? `${i18n.t(`commands:guildDaily.rewards.${rewardKey}`, {
			lng,
			quantity
		})}\n`
		: "";
}

export function getCommandGuildDailyRewardPacketString(packet: CommandGuildDailyRewardPacket, lng: Language): string {
	let desc = "";
	const rewards: Record<string, number | undefined> = {
		fullHeal: packet.fullHeal as number | undefined,
		advanceTime: packet.advanceTime,
		personalXP: packet.personalXp,
		guildXP: packet.guildXp,
		superBadge: packet.superBadge as number | undefined,
		badge: packet.badge as number | undefined,
		money: packet.money,
		partialHeal: packet.heal,
		[packet.alteration?.healAmount ? "alterationHeal" : "alterationNoHeal"]: packet.alteration ? packet.alteration.healAmount ?? 1 : undefined,
		petFood: packet.commonFood
	};

	for (const [key, value] of Object.entries(rewards)) {
		desc += manageGivenReward(key, value, lng);
	}

	if (packet.pet) {
		desc += `${i18n.t("commands:guildDaily.rewards.pet", {
			lng,
			context: packet.pet.isFemale ? StringConstants.SEX.FEMALE.long : StringConstants.SEX.MALE.long,
			pet: DisplayUtils.getPetDisplay(packet.pet.typeId, packet.pet.isFemale ? StringConstants.SEX.FEMALE.short : StringConstants.SEX.MALE.short, lng),
			petId: packet.pet.typeId
		})}\n`;
	}

	return desc;
}

export async function handleCommandGuildDailyRewardPacket(packet: CommandGuildDailyRewardPacket, context: PacketContext, reply: boolean): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!)!;
	const lng = interaction.userLanguage;

	const embed = new CrowniclesEmbed()
		.formatAuthor(i18n.t("commands:guildDaily.rewardTitle", {
			lng,
			guildName: packet.guildName
		}), interaction.user)
		.setDescription(getCommandGuildDailyRewardPacketString(packet, lng));

	if (reply) {
		if (interaction.deferred) {
			await interaction.editReply({
				embeds: [embed]
			});
		}
		else {
			await interaction.reply({
				embeds: [embed]
			});
		}
	}
	else {
		await interaction.channel.send({
			embeds: [embed]
		});
	}
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("guildDaily") as SlashCommandBuilder,
	getPacket,
	mainGuildCommand: false
};
