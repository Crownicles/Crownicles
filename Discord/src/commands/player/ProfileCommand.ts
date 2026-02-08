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
	ColorResolvable, EmbedField, Message, MessageReaction, ReactionCollector
} from "discord.js";
import { Constants } from "../../../../Lib/src/constants/Constants";
import { DiscordCache } from "../../bot/DiscordCache";
import { ProfileConstants } from "../../../../Lib/src/constants/ProfileConstants";
import { Language } from "../../../../Lib/src/Language";
import { KeycloakUser } from "../../../../Lib/src/keycloak/KeycloakUser";
import { PacketUtils } from "../../utils/PacketUtils";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import { millisecondsToMinutes } from "../../../../Lib/src/utils/TimeUtils";
import { DisplayUtils } from "../../utils/DisplayUtils";
import { Badge } from "../../../../Lib/src/types/Badge";
import { TokensConstants } from "../../../../Lib/src/constants/TokensConstants";
import { ColorConstants } from "../../../../Lib/src/constants/ColorConstants";

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
 * Add information field (health, money, experience, tokens)
 */
function addInformationField(fields: EmbedField[], packet: CommandProfilePacketRes, lng: Language): void {
	const showTokens = packet.playerData.level >= TokensConstants.LEVEL_TO_UNLOCK;
	addField(fields, showTokens ? "information" : "informationNoTokens", true, {
		lng,
		health: packet.playerData.health.value,
		maxHealth: packet.playerData.health.max,
		money: packet.playerData.money,
		experience: packet.playerData.experience.value,
		experienceNeededToLevelUp: packet.playerData.experience.max,
		tokens: packet.playerData.tokens ?? 0,
		tokensMax: packet.playerData.tokensMax ?? TokensConstants.MAX
	});
}

/**
 * Add fight ranking field
 */
function addFightRankingField(fields: EmbedField[], packet: CommandProfilePacketRes, lng: Language): void {
	const fightRanking = packet.playerData.fightRanking;
	const isRanked = fightRanking && fightRanking.gloryRank !== -1;
	const fieldKey = isRanked ? "fightRanked" : "fightUnranked";

	addField(fields, fieldKey, Boolean(fightRanking), {
		lng,
		rank: fightRanking?.gloryRank ?? 0,
		numberOfPlayers: fightRanking?.numberOfFighters ?? 0,
		leagueEmoji: fightRanking?.league ? CrowniclesIcons.leagues[fightRanking.league] : "",
		leagueId: fightRanking?.league ?? 0,
		gloryPoints: fightRanking?.glory ?? 0
	});
}

/**
 * Add pet field with all pet details
 */
function addPetField(fields: EmbedField[], packet: CommandProfilePacketRes, lng: Language): void {
	const pet = packet.playerData.pet;
	addField(fields, "pet", Boolean(pet), {
		lng,
		rarity: pet ? DisplayUtils.getPetRarityDisplay(pet.rarity, lng) : "",
		emote: pet ? DisplayUtils.getPetIcon(pet.typeId, pet.sex) : "",
		name: pet ? pet.nickname || DisplayUtils.getPetTypeName(lng, pet.typeId, pet.sex) : ""
	});
}

/**
 * Add statistics field
 */
function addStatisticsField(fields: EmbedField[], packet: CommandProfilePacketRes, lng: Language): void {
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
}

/**
 * Add rank and effect fields
 */
function addRankAndEffectFields(fields: EmbedField[], packet: CommandProfilePacketRes, lng: Language): void {
	const rankFieldKey = packet.playerData.rank.unranked ? "unranked" : "ranking";
	addField(fields, rankFieldKey, true, {
		lng,
		score: packet.playerData.rank.score,
		rank: packet.playerData.rank.rank,
		numberOfPlayer: packet.playerData.rank.numberOfPlayers
	});

	const effectFieldKey = packet.playerData.effect.healed ? "noTimeLeft" : "timeLeft";
	addField(fields, effectFieldKey, Boolean(packet.playerData.effect.hasTimeDisplay), {
		lng,
		effectId: packet.playerData.effect.effect,
		timeLeft: i18n.formatDuration(millisecondsToMinutes(packet.playerData.effect.timeLeft), lng)
	});
}

/**
 * Add location fields (class, guild, map)
 */
function addLocationFields(fields: EmbedField[], packet: CommandProfilePacketRes, lng: Language): void {
	const hasClass = Boolean(packet.playerData.classId) || packet.playerData.classId === 0;
	addField(fields, "playerClass", hasClass, {
		lng,
		id: packet.playerData.classId
	});

	addField(fields, "guild", Boolean(packet.playerData.guild), {
		lng,
		guild: packet.playerData.guild
	});

	const hasMap = Boolean(packet.playerData.destinationId && packet.playerData.mapTypeId);
	addField(fields, "map", hasMap, {
		lng,
		mapTypeId: packet.playerData.mapTypeId,
		mapName: packet.playerData.destinationId
	});
}

/**
 * Generate the fields of the profile embed
 * @param packet
 * @param lng
 */
function generateFields(packet: CommandProfilePacketRes, lng: Language): EmbedField[] {
	const fields: EmbedField[] = [];

	addInformationField(fields, packet, lng);
	addStatisticsField(fields, packet, lng);

	addField(fields, "mission", true, {
		lng,
		gems: packet.playerData.missions.gems,
		campaign: packet.playerData.missions.campaignProgression
	});

	addRankAndEffectFields(fields, packet, lng);
	addLocationFields(fields, packet, lng);
	addFightRankingField(fields, packet, lng);
	addPetField(fields, packet, lng);

	return fields;
}

/**
 * Handle the response of the profile command
 * @param packet
 * @param context
 */
/**
 * Handle badge reaction collection
 */
function handleBadgeReaction(
	reaction: MessageReaction,
	collector: ReactionCollector,
	pseudo: string,
	badges: Badge[],
	interaction: CrowniclesInteraction,
	lng: Language
): void {
	if (reaction.emoji.name === CrowniclesIcons.profile.displayAllBadgeEmote) {
		collector.stop(); // Only one is allowed to avoid spam
		sendMessageAllBadgesTooMuchBadges(pseudo, badges, interaction).catch(() => undefined);
		return;
	}

	const badge = Object.entries(CrowniclesIcons.badges).find(badgeEntry => badgeEntry[1] === reaction.emoji.name);
	if (badge) {
		interaction.channel.send({ content: `\`${reaction.emoji.name!} ${i18n.t(`commands:profile.badges.${badge[0]}`, { lng })}\`` })
			.then((msg: Message | null) => {
				setTimeout(() => msg?.delete(), ProfileConstants.BADGE_DESCRIPTION_TIMEOUT);
			});
	}
}

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
				.setColor(<ColorResolvable>(packet.playerData.color ?? ColorConstants.PROFILE_DEFAULT))
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
	collector.on("collect", reaction => {
		handleBadgeReaction(reaction, collector, pseudo, packet.playerData!.badges!, interaction, lng);
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
