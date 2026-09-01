import { DiscordCache } from "../../bot/DiscordCache";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import i18n from "../../translations/i18n";
import {
	CommandTournamentCancelPacketRes, CommandTournamentCreatePacketRes,
	CommandTournamentErrorPacketRes, CommandTournamentGenerateCodePacketRes,
	CommandTournamentRegisterPacketRes, CommandTournamentResumePacketRes,
	CommandTournamentStatusPacketRes, CommandTournamentTopPacketRes
} from "../../../../Lib/src/packets/commands/CommandTournamentPacket";
import { PacketContext } from "../../../../Lib/src/packets/CrowniclesPacket";
import { Language } from "../../../../Lib/src/Language";
import {
	dateDisplay, finishInTimeDisplay
} from "../../../../Lib/src/utils/TimeUtils";
import { resolveKeycloakPlayerName } from "../../utils/KeycloakPlayerUtils";
import { DisplayUtils } from "../../utils/DisplayUtils";
import { TournamentFightRewardPacket } from "../../../../Lib/src/packets/fights/TournamentFightRewardPacket";
import { escapeUsername } from "../../utils/StringUtils";

function getInteraction(context: PacketContext): CrowniclesInteraction | null {
	return context.discord?.interaction ? DiscordCache.getInteraction(context.discord.interaction) : null;
}

type TournamentEmbedBuilder = (interaction: CrowniclesInteraction) => CrowniclesEmbed;

async function editTournamentReply(context: PacketContext, buildEmbed: TournamentEmbedBuilder): Promise<void> {
	const interaction = getInteraction(context);
	if (!interaction) {
		return;
	}
	await interaction.editReply({
		embeds: [buildEmbed(interaction)]
	});
}

export async function handleTournamentGenerateCode(context: PacketContext, packet: CommandTournamentGenerateCodePacketRes): Promise<void> {
	await editTournamentReply(context, interaction => new CrowniclesEmbed()
		.setTitle(i18n.t("commands:tournament.codeTitle", { lng: interaction.userLanguage }))
		.setDescription(i18n.t("commands:tournament.codeCreated", {
			lng: interaction.userLanguage,
			code: packet.code,
			expiresAt: dateDisplay(new Date(packet.expiresAt))
		})));
}

export async function handleTournamentCreate(context: PacketContext, packet: CommandTournamentCreatePacketRes): Promise<void> {
	await editTournamentReply(context, interaction => new CrowniclesEmbed()
		.setTitle(i18n.t("commands:tournament.createTitle", { lng: interaction.userLanguage }))
		.setDescription(i18n.t("commands:tournament.created", {
			lng: interaction.userLanguage,
			tournamentId: packet.tournamentId,
			registrationEndsAt: dateDisplay(new Date(packet.registrationEndsAt)),
			combatEndsAt: dateDisplay(new Date(packet.combatEndsAt)),
			channel: `<#${packet.channelId}>`
		})));
}

export async function handleTournamentRegister(context: PacketContext, packet: CommandTournamentRegisterPacketRes): Promise<void> {
	await editTournamentReply(context, interaction => new CrowniclesEmbed()
		.setTitle(i18n.t("commands:tournament.registerTitle", { lng: interaction.userLanguage }))
		.setDescription(i18n.t("commands:tournament.registered", {
			lng: interaction.userLanguage,
			category: i18n.t(`commands:tournament.categories.${packet.category}`, { lng: interaction.userLanguage }),
			attackGloryPoints: packet.attackGloryPoints,
			defenseGloryPoints: packet.defenseGloryPoints,
			lateRegistration: packet.lateRegistration
				? i18n.t("commands:tournament.lateRegistration", { lng: interaction.userLanguage })
				: ""
		})));
}

export async function handleTournamentStatus(context: PacketContext, packet: CommandTournamentStatusPacketRes): Promise<void> {
	await editTournamentReply(context, interaction => {
		const lng = interaction.userLanguage;
		return new CrowniclesEmbed()
			.setTitle(i18n.t("commands:tournament.statusTitle", { lng }))
			.setDescription(i18n.t("commands:tournament.status", {
				lng,
				tournamentId: packet.tournamentId,
				status: i18n.t(`commands:tournament.statuses.${packet.status}`, { lng }),
				registrationEndsAt: finishInTimeDisplay(new Date(packet.registrationEndsAt)),
				combatEndsAt: finishInTimeDisplay(new Date(packet.combatEndsAt)),
				participantCount: packet.participantCount,
				level50Count: packet.categoryCounts.level50,
				level100Count: packet.categoryCounts.level100,
				category: packet.category
					? i18n.t(`commands:tournament.categories.${packet.category}`, { lng })
					: i18n.t("commands:tournament.notRegistered", { lng }),
				attackGloryPoints: packet.attackGloryPoints ?? 0,
				defenseGloryPoints: packet.defenseGloryPoints ?? 0
			}));
	});
}

export async function handleTournamentResume(context: PacketContext, packet: CommandTournamentResumePacketRes): Promise<void> {
	await editTournamentReply(context, interaction => new CrowniclesEmbed()
		.setTitle(i18n.t("commands:tournament.resumeTitle", { lng: interaction.userLanguage }))
		.setDescription(i18n.t("commands:tournament.resumed", {
			lng: interaction.userLanguage,
			tournamentId: packet.tournamentId,
			channel: `<#${packet.channelId}>`
		})));
}

export async function handleTournamentCancel(context: PacketContext, packet: CommandTournamentCancelPacketRes): Promise<void> {
	await editTournamentReply(context, interaction => new CrowniclesEmbed()
		.setTitle(i18n.t("commands:tournament.cancelTitle", { lng: interaction.userLanguage }))
		.setDescription(i18n.t("commands:tournament.cancelled", {
			lng: interaction.userLanguage,
			tournamentId: packet.tournamentId
		})));
}

export async function handleTournamentTop(context: PacketContext, packet: CommandTournamentTopPacketRes): Promise<void> {
	const interaction = getInteraction(context);
	if (!interaction) {
		return;
	}
	const lng: Language = interaction.userLanguage;
	const categoryDescriptions = await Promise.all(packet.categories.map(async category => {
		const entries = await Promise.all(category.elements.map(async element => ({
			...element,
			username: await resolveKeycloakPlayerName(element.playerKeycloakId, lng)
		})));
		const lines = entries.map(element => i18n.t("commands:tournament.topEntry", {
			lng,
			rank: element.rank,
			pseudo: escapeUsername(element.username),
			attackGloryPoints: DisplayUtils.formatNumber(element.attackGloryPoints, lng),
			defenseGloryPoints: DisplayUtils.formatNumber(element.defenseGloryPoints, lng),
			totalGloryPoints: DisplayUtils.formatNumber(element.totalGloryPoints, lng),
			effectiveLevel: element.effectiveLevel
		}));
		return i18n.t("commands:tournament.topCategory", {
			lng,
			category: i18n.t(`commands:tournament.categories.${category.category}`, { lng }),
			totalParticipants: category.totalParticipants,
			yourRank: category.yourRank ?? i18n.t("commands:tournament.unranked", { lng }),
			entries: lines.join("\n") || i18n.t("commands:tournament.emptyCategory", { lng })
		});
	}));
	await interaction.editReply({
		embeds: [
			new CrowniclesEmbed()
				.setTitle(i18n.t("commands:tournament.topTitle", {
					lng,
					pageNumber: packet.pageNumber,
					totalPages: packet.totalPages
				}))
				.setDescription(categoryDescriptions.join("\n\n"))
		]
	});
}

export async function handleTournamentError(context: PacketContext, packet: CommandTournamentErrorPacketRes): Promise<void> {
	await editTournamentReply(context, interaction => new CrowniclesEmbed()
		.setErrorColor()
		.setTitle(i18n.t("commands:tournament.errorTitle", { lng: interaction.userLanguage }))
		.setDescription(i18n.t(`commands:tournament.errors.${packet.errorCode}`, { lng: interaction.userLanguage })));
}

export async function handleTournamentFightReward(context: PacketContext, packet: TournamentFightRewardPacket): Promise<void> {
	const interaction = getInteraction(context);
	if (!interaction) {
		return;
	}
	const lng = interaction.userLanguage;
	const player1 = await resolveKeycloakPlayerName(packet.player1.keycloakId, lng);
	const player2 = await resolveKeycloakPlayerName(packet.player2.keycloakId, lng);
	const getChange = (oldValue: number, newValue: number): number => newValue - oldValue;
	await interaction.channel?.send({
		embeds: [
			new CrowniclesEmbed()
				.setTitle(i18n.t("commands:tournament.fightReward.title", { lng }))
				.setDescription(i18n.t(packet.draw
					? "commands:tournament.fightReward.draw"
					: "commands:tournament.fightReward.result", {
					lng,
					player1: escapeUsername(player1),
					player2: escapeUsername(player2),
					winner: packet.winnerKeycloakId === packet.player1.keycloakId ? escapeUsername(player1) : escapeUsername(player2),
					player1AttackChange: getChange(packet.player1.oldAttackGloryPoints, packet.player1.newAttackGloryPoints),
					player1DefenseChange: getChange(packet.player1.oldDefenseGloryPoints, packet.player1.newDefenseGloryPoints),
					player2AttackChange: getChange(packet.player2.oldAttackGloryPoints, packet.player2.newAttackGloryPoints),
					player2DefenseChange: getChange(packet.player2.oldDefenseGloryPoints, packet.player2.newDefenseGloryPoints)
				}))
		]
	});
}
