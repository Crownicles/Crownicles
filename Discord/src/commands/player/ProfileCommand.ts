import { ICommand } from "../ICommand";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import i18n, { TranslationOption } from "../../translations/i18n";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import {
	CommandProfilePacketReq,
	CommandProfilePacketRes
} from "../../../../Lib/src/packets/commands/CommandProfilePacket";
import { SlashCommandBuilder } from "@discordjs/builders";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import {
	ColorResolvable, EmbedField, Message, MessageReaction
} from "discord.js";
import { Constants } from "../../../../Lib/src/constants/Constants";
import { DiscordCache } from "../../bot/DiscordCache";
import { ProfileConstants } from "../../../../Lib/src/constants/ProfileConstants";
import { Language } from "../../../../Lib/src/Language";
import { KeycloakUser } from "../../../../Lib/src/keycloak/KeycloakUser";
import { PacketUtils } from "../../utils/PacketUtils";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import {
	millisecondsToMinutes, minutesDisplay
} from "../../../../Lib/src/utils/TimeUtils";
import { DisplayUtils } from "../../utils/DisplayUtils";
import { Badge } from "../../../../Lib/src/types/Badge";

/**
 * Display the profile of a player
 */
async function getPacket(interaction: CrowniclesInteraction, keycloakUser: KeycloakUser): Promise<CommandProfilePacketReq | null> {
	const askedPlayer = await PacketUtils.prepareAskedPlayer(interaction, keycloakUser);
	if (!askedPlayer) {
		return null;
	}
	return makePacket(CommandProfilePacketReq, { askedPlayer });
}

/**
 * Send a message with all the badges of the player in case there are too many
 * @param gameUsername
 * @param badges
 * @param interaction
 */
async function sendMessageAllBadgesTooMuchBadges(gameUsername: string, badges: Badge[], interaction: CrowniclesInteraction): Promise<void> {
	const lng = interaction.userLanguage;
	let content = "";
	for (const badgeId of badges) {
		const badgeEmote = CrowniclesIcons.badges[badgeId];
		if (badgeEmote) {
			content += `${badgeEmote} \`${i18n.t(`commands:profile.badges.${badgeId}`, { lng: interaction.userLanguage })}\`\n`;
		}
	}
	await interaction.followUp({
		embeds: [
			new CrowniclesEmbed()
				.setTitle(i18n.t("commands:profile.badgeDisplay.title", {
					lng,
					pseudo: gameUsername
				}))
				.setDescription(content + i18n.t("commands:profile.badgeDisplay.numberBadge", {
					lng,
					count: badges.length
				}))
		]
	});
}

/**
 * Display the badges of the player as reactions
 * @param badges
 * @param msg
 */
async function displayBadges(badges: Badge[], msg: Message): Promise<void> {
	if (badges.length >= Constants.PROFILE.MAX_EMOTE_DISPLAY_NUMBER) {
		await msg.react(CrowniclesIcons.profile.displayAllBadgeEmote);
		return;
	}
	for (const badgeId of badges) {
		const badgeEmote = CrowniclesIcons.badges[badgeId];
		if (badgeEmote) {
			await msg.react(badgeEmote);
		}
	}
}

/**
 * Add a field to the profile embed
 * @param fields
 * @param fieldKey
 * @param shouldBeFielded
 * @param replacements
 */
function addField(fields: EmbedField[], fieldKey: string, shouldBeFielded: boolean, replacements: TranslationOption & {
	returnObjects?: false;
}): void {
	if (shouldBeFielded) {
		fields.push({
			name: i18n.t(`commands:profile.${fieldKey}.fieldName`, replacements),
			value: i18n.t(`commands:profile.${fieldKey}.fieldValue`, replacements),
			inline: false
		});
	}
}

/**
 * Generate the fields of the profile embed
 * @param packet
 * @param lng
 */
function generateFields(packet: CommandProfilePacketRes, lng: Language): EmbedField[] {
	const fields: EmbedField[] = [];
	addField(fields, "information", true, {
		lng,
		health: packet.playerData.health.value,
		maxHealth: packet.playerData.health.max,
		money: packet.playerData.money,
		experience: packet.playerData.experience.value,
		experienceNeededToLevelUp: packet.playerData.experience.max
	});

	addField(fields, "statistics", Boolean(packet.playerData.stats), {
		lng,
		baseBreath: packet.playerData.stats?.breath.base,
		breathRegen: packet.playerData.stats?.breath.regen,
		cumulativeAttack: packet.playerData.stats?.attack,
		cumulativeDefense: packet.playerData.stats?.defense,
		cumulativeHealth: packet.playerData.stats?.energy.value,
		cumulativeSpeed: packet.playerData.stats?.speed,
		cumulativeMaxHealth: packet.playerData.stats?.energy.max,
		maxBreath: packet.playerData.stats?.breath.max
	});

	addField(fields, "mission", true, {
		lng,
		gems: packet.playerData.missions.gems,
		campaign: packet.playerData.missions.campaignProgression
	});

	addField(fields, packet.playerData.rank.unranked ? "unranked" : "ranking", true, {
		lng,
		score: packet.playerData.rank.score,
		rank: packet.playerData.rank.rank,
		numberOfPlayer: packet.playerData.rank.numberOfPlayers
	});

	addField(fields, packet.playerData.effect.healed ? "noTimeLeft" : "timeLeft", Boolean(packet.playerData.effect.hasTimeDisplay), {
		lng,
		effectId: packet.playerData.effect.effect,
		timeLeft: minutesDisplay(millisecondsToMinutes(packet.playerData.effect.timeLeft), lng)
	});

	addField(fields, "playerClass", Boolean(packet.playerData.classId) || packet.playerData.classId === 0, {
		lng,
		id: packet.playerData.classId
	});

	addField(fields,
		packet.playerData.fightRanking
			? packet.playerData.fightRanking.gloryRank !== -1 ? "fightRanked" : "fightUnranked"
			: "fightUnranked", Boolean(packet.playerData.fightRanking), {
			lng,
			rank: packet.playerData.fightRanking?.gloryRank ?? 0,
			numberOfPlayers: packet.playerData.fightRanking?.numberOfFighters ?? 0,
			leagueEmoji: packet.playerData.fightRanking?.league ? CrowniclesIcons.leagues[packet.playerData.fightRanking.league] : "",
			leagueId: packet.playerData.fightRanking?.league ?? 0,
			gloryPoints: packet.playerData.fightRanking?.glory ?? 0
		});

	addField(fields, "guild", Boolean(packet.playerData.guild), {
		lng,
		guild: packet.playerData.guild
	});

	addField(fields, "map", Boolean(packet.playerData.destinationId && packet.playerData.mapTypeId), {
		lng,
		mapTypeId: packet.playerData.mapTypeId,
		mapName: packet.playerData.destinationId
	});

	addField(fields, "pet", Boolean(packet.playerData.pet), {
		lng,
		rarity: CrowniclesIcons.unitValues.petRarity
			.repeat(packet.playerData.pet?.rarity ?? 0),
		emote: packet.playerData.pet ? DisplayUtils.getPetIcon(packet.playerData.pet?.typeId, packet.playerData.pet?.sex) : "",
		name: packet.playerData.pet ? packet.playerData.pet?.nickname ?? DisplayUtils.getPetTypeName(lng, packet.playerData.pet?.typeId, packet.playerData.pet?.sex) : ""
	});

	return fields;
}

/**
 * Handle the response of the profile command
 * @param packet
 * @param context
 */
export async function handleCommandProfilePacketRes(packet: CommandProfilePacketRes, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);

	if (!interaction) {
		return;
	}
	const lng = interaction.userLanguage;
	const titleEffect = packet.playerData.effect.healed ? "healed" : packet.playerData.effect.effect;
	const pseudo = await DisplayUtils.getEscapedUsername(packet.keycloakId, lng);
	const reply = await interaction.reply({
		embeds: [
			new CrowniclesEmbed()
				.setColor(<ColorResolvable>packet.playerData!.color)
				.setTitle(i18n.t("commands:profile.title", {
					lng,
					effectId: titleEffect,
					pseudo,
					level: packet.playerData?.level
				}))
				.addFields(generateFields(packet, lng))
		],
		withResponse: true
	});
	if (!reply?.resource?.message) {
		// An error occurred and no message was fetched
		return;
	}
	const message = reply.resource.message;
	const collector = message.createReactionCollector({
		filter: (reaction: MessageReaction) => reaction.me && !reaction.users.cache.last()!.bot,
		time: Constants.MESSAGES.COLLECTOR_TIME,
		max: ProfileConstants.BADGE_MAXIMUM_REACTION
	});
	collector.on("collect", async reaction => {
		if (reaction.emoji.name === CrowniclesIcons.profile.displayAllBadgeEmote) {
			collector.stop(); // Only one is allowed to avoid spam
			await sendMessageAllBadgesTooMuchBadges(pseudo, packet.playerData!.badges!, interaction);
		}
		else {
			const badge = Object.entries(CrowniclesIcons.badges).find(badgeEntry => badgeEntry[1] === reaction.emoji.name);
			if (badge) {
				interaction.channel.send({ content: `\`${reaction.emoji.name!} ${i18n.t(`commands:profile.badges.${badge[0]}`, { lng })}\`` })
					.then((msg: Message | null) => {
						setTimeout(() => msg?.delete(), ProfileConstants.BADGE_DESCRIPTION_TIMEOUT);
					});
			}
		}
	});
	if (packet.playerData?.badges.length !== 0) {
		await displayBadges(packet.playerData!.badges, message);
	}
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("profile")
		.addUserOption(option =>
			SlashCommandBuilderGenerator.generateOption("profile", "user", option)
				.setRequired(false))
		.addIntegerOption(option =>
			SlashCommandBuilderGenerator.generateOption("profile", "rank", option)
				.setRequired(false)) as SlashCommandBuilder,
	getPacket,
	mainGuildCommand: false
};
