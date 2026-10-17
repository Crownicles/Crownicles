import {
	ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedField, Message
} from "discord.js";
import {
	CommandTournamentRegisterPacketReq, CommandTournamentStatusPacketRes, CommandTournamentUnregisterPacketReq
} from "../../../../Lib/src/packets/commands/CommandTournamentPacket";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { TournamentConstants } from "../../../../Lib/src/constants/TournamentConstants";
import { Constants } from "../../../../Lib/src/constants/Constants";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import { Language } from "../../../../Lib/src/Language";
import {
	TournamentLevelSettings, TournamentStatuses
} from "../../../../Lib/src/types/Tournament";
import {
	dateDisplay, finishInTimeDisplay
} from "../../../../Lib/src/utils/TimeUtils";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import { DisplayUtils } from "../../utils/DisplayUtils";
import { PacketUtils } from "../../utils/PacketUtils";
import { sendInteractionNotForYou } from "../../utils/ErrorUtils";
import i18n from "../../translations/i18n";
import {
	getTournamentCategoryLabel, getTournamentLevelRuleDescription, getTournamentThresholdsProgress
} from "./TournamentDisplayUtils";

const REGISTRATION_BUTTON_IDS = {
	REGISTER: "TOURNAMENT_REGISTER",
	UNREGISTER: "TOURNAMENT_UNREGISTER"
} as const;

const REGISTRATION_CHOICE_MADE = "registrationChoiceMade";

type StatusPacket = CommandTournamentStatusPacketRes;

function getLevelSettings(packet: StatusPacket): TournamentLevelSettings {
	return {
		levelLimitMode: packet.levelLimitMode,
		levelCap: packet.levelCap
	};
}

function getPhaseEnd(packet: StatusPacket, lng: Language): string {
	switch (packet.status) {
		case TournamentStatuses.REGISTRATION:
			return i18n.t("commands:tournament.phaseEndRegistration", {
				lng,
				date: finishInTimeDisplay(new Date(packet.registrationEndsAt))
			});
		case TournamentStatuses.COMBAT:
			return i18n.t("commands:tournament.phaseEndCombat", {
				lng,
				date: finishInTimeDisplay(new Date(packet.combatEndsAt))
			});
		case TournamentStatuses.PAUSED:
			return i18n.t("commands:tournament.phaseEndPaused", { lng });
		default:
			return i18n.t("commands:tournament.phaseEndOver", { lng });
	}
}

function buildTournamentField(packet: StatusPacket, lng: Language): EmbedField {
	return {
		name: i18n.t("commands:tournament.tournamentField.fieldName", { lng }),
		value: i18n.t("commands:tournament.tournamentField.fieldValue", {
			lng,
			channel: `<#${packet.discordChannelId}>`,
			phaseEnd: getPhaseEnd(packet, lng),
			levelRule: getTournamentLevelRuleDescription(getLevelSettings(packet), lng)
		}),
		inline: false
	};
}

function buildParticipantsField(packet: StatusPacket, lng: Language): EmbedField {
	if (packet.status === TournamentStatuses.REGISTRATION) {
		return {
			name: i18n.t("commands:tournament.thresholds.fieldName", { lng }),
			value: i18n.t("commands:tournament.thresholds.fieldValue", {
				lng,
				progress: getTournamentThresholdsProgress(getLevelSettings(packet), {
					total: packet.participantCount,
					byCategory: packet.categoryCounts
				}, lng)
			}),
			inline: false
		};
	}
	return {
		name: i18n.t("commands:tournament.participantsField.fieldName", { lng }),
		value: i18n.t("commands:tournament.participantsField.fieldValue", {
			lng,
			count: packet.participantCount
		}),
		inline: false
	};
}

function getNotRegisteredDescription(packet: StatusPacket, lng: Language): string {
	if (packet.canRegister) {
		return i18n.t("commands:tournament.notRegisteredField.canRegister", { lng });
	}
	const registrationOpen = packet.status === TournamentStatuses.REGISTRATION || packet.status === TournamentStatuses.COMBAT;
	return i18n.t(registrationOpen
		? "commands:tournament.notRegisteredField.registerInChannel"
		: "commands:tournament.notRegisteredField.notParticipating", {
		lng,
		channel: `<#${packet.discordChannelId}>`
	});
}

function buildParticipationField(packet: StatusPacket, lng: Language): EmbedField {
	if (!packet.category) {
		return {
			name: i18n.t("commands:tournament.notRegisteredField.fieldName", { lng }),
			value: getNotRegisteredDescription(packet, lng),
			inline: false
		};
	}
	const record = packet.record && packet.status !== TournamentStatuses.REGISTRATION
		? i18n.t("commands:tournament.participationField.record", {
			lng,
			...packet.record
		})
		: "";
	return {
		name: i18n.t("commands:tournament.participationField.fieldName", { lng }),
		value: i18n.t("commands:tournament.participationField.fieldValue", {
			lng,
			category: getTournamentCategoryLabel(packet.category, lng),
			rank: packet.rank ?? i18n.t("commands:tournament.unranked", { lng }),
			categoryParticipantCount: packet.categoryCounts[packet.category],
			totalGloryPoints: DisplayUtils.formatNumber(packet.totalGloryPoints ?? 0, lng),
			lateRegistration: packet.lateRegistration
				? i18n.t("commands:tournament.participationField.lateRegistration", { lng })
				: "",
			record
		}),
		inline: false
	};
}

function buildLateRegistrationField(packet: StatusPacket, lng: Language): EmbedField | null {
	if (!packet.canRegister || packet.status !== TournamentStatuses.COMBAT) {
		return null;
	}
	return {
		name: i18n.t("commands:tournament.lateRegistrationField.fieldName", { lng }),
		value: i18n.t("commands:tournament.lateRegistrationField.fieldValue", {
			lng,
			lateGlory: DisplayUtils.formatNumber(TournamentConstants.INITIAL_ATTACK_GLORY + TournamentConstants.LATE_INITIAL_DEFENSE_GLORY, lng),
			normalGlory: DisplayUtils.formatNumber(TournamentConstants.INITIAL_ATTACK_GLORY + TournamentConstants.INITIAL_DEFENSE_GLORY, lng)
		}),
		inline: false
	};
}

function buildHowToField(packet: StatusPacket, lng: Language): EmbedField {
	return {
		name: i18n.t("commands:tournament.howToField.fieldName", { lng }),
		value: i18n.t(`commands:tournament.howToField.${packet.status}`, {
			lng,
			channel: `<#${packet.discordChannelId}>`,
			combatStart: dateDisplay(new Date(packet.registrationEndsAt)),
			maxGames: TournamentConstants.BO3_MAX_GAMES,
			winsToFinish: TournamentConstants.BO3_WINS_TO_FINISH
		}),
		inline: false
	};
}

function buildRewardField(packet: StatusPacket, lng: Language): EmbedField | null {
	if (!packet.reward) {
		return null;
	}
	return {
		name: i18n.t("commands:tournament.rewardField.fieldName", { lng }),
		value: i18n.t(packet.reward.granted
			? "commands:tournament.rewardField.granted"
			: "commands:tournament.rewardField.pending", {
			lng,
			xp: DisplayUtils.formatNumber(packet.reward.xp, lng),
			money: DisplayUtils.formatNumber(packet.reward.money, lng),
			count: packet.reward.itemCount
		}),
		inline: false
	};
}

function buildStatusEmbed(packet: StatusPacket, lng: Language): CrowniclesEmbed {
	const embed = new CrowniclesEmbed()
		.setTitle(i18n.t("commands:tournament.statusTitle", {
			lng,
			status: i18n.t(`commands:tournament.statuses.${packet.status}`, { lng })
		}));
	if (packet.registrationChange) {
		embed.setDescription(i18n.t(`commands:tournament.registrationChanges.${packet.registrationChange}`, {
			lng,
			category: packet.category ? getTournamentCategoryLabel(packet.category, lng) : "",
			totalGloryPoints: DisplayUtils.formatNumber(packet.totalGloryPoints ?? 0, lng)
		}));
	}
	const fields = [
		buildTournamentField(packet, lng),
		buildParticipantsField(packet, lng),
		buildParticipationField(packet, lng),
		buildLateRegistrationField(packet, lng),
		buildHowToField(packet, lng),
		buildRewardField(packet, lng)
	].filter((field): field is EmbedField => field !== null);
	return embed.addFields(fields);
}

function buildRegistrationButtons(packet: StatusPacket, lng: Language): ActionRowBuilder<ButtonBuilder>[] {
	if (packet.canRegister) {
		return [
			new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder()
				.setCustomId(REGISTRATION_BUTTON_IDS.REGISTER)
				.setLabel(i18n.t("commands:tournament.registerButton", { lng }))
				.setEmoji(CrowniclesIcons.collectors.accept)
				.setStyle(ButtonStyle.Success))
		];
	}
	if (packet.canUnregister) {
		return [
			new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder()
				.setCustomId(REGISTRATION_BUTTON_IDS.UNREGISTER)
				.setLabel(i18n.t("commands:tournament.unregisterButton", { lng }))
				.setEmoji(CrowniclesIcons.collectors.refuse)
				.setStyle(ButtonStyle.Danger))
		];
	}
	return [];
}

function collectRegistrationChoice(context: PacketContext, interaction: CrowniclesInteraction, message: Message): void {
	const collector = message.createMessageComponentCollector({ time: Constants.MESSAGES.COLLECTOR_TIME });
	collector.on("collect", async componentInteraction => {
		if (componentInteraction.user.id !== interaction.user.id) {
			await sendInteractionNotForYou(componentInteraction.user, componentInteraction, interaction.userLanguage);
			return;
		}
		await componentInteraction.deferUpdate();
		collector.stop(REGISTRATION_CHOICE_MADE);
		PacketUtils.sendPacketToBackend(context, componentInteraction.customId === REGISTRATION_BUTTON_IDS.REGISTER
			? makePacket(CommandTournamentRegisterPacketReq, {})
			: makePacket(CommandTournamentUnregisterPacketReq, {}));
	});
	collector.on("end", async (_collected, reason) => {
		if (reason === REGISTRATION_CHOICE_MADE) {
			return;
		}
		await interaction.editReply({ components: [] })
			.catch((error: unknown) => CrowniclesLogger.errorWithObj("Failed to remove the tournament registration buttons", error));
	});
}

export async function displayTournamentStatus(
	context: PacketContext,
	interaction: CrowniclesInteraction,
	packet: StatusPacket
): Promise<void> {
	const lng = interaction.userLanguage;
	const components = buildRegistrationButtons(packet, lng);
	const message = await interaction.editReply({
		embeds: [buildStatusEmbed(packet, lng)],
		components
	});
	if (message && components.length > 0) {
		collectRegistrationChoice(context, interaction, message);
	}
}
