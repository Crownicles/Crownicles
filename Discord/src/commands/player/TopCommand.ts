import {
	CommandTopPacketReq,
	CommandTopPacketRes,
	CommandTopPacketResGlory,
	CommandTopPacketResGuild,
	CommandTopPacketResScore,
	CommandTopPlayersEmptyPacket
} from "../../../../Lib/src/packets/commands/CommandTopPacket";
import i18n from "../../translations/i18n";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	TopElement, TopElementScoreFirstType
} from "../../../../Lib/src/types/TopElement";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import {
	LANGUAGE, Language
} from "../../../../Lib/src/Language";
import { KeycloakUtils } from "../../../../Lib/src/keycloak/KeycloakUtils";
import { keycloakConfig } from "../../bot/CrowniclesShard";
import { DiscordCache } from "../../bot/DiscordCache";
import { TopTiming } from "../../../../Lib/src/types/TopTimings";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import { ICommand } from "../ICommand";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import { TopDataType } from "../../../../Lib/src/types/TopDataType";
import {
	SlashCommandBuilder, SlashCommandSubcommandBuilder
} from "@discordjs/builders";
import { CrowniclesErrorEmbed } from "../../messages/CrowniclesErrorEmbed";
import { escapeUsername } from "../../utils/StringUtils";
import { DisplayUtils } from "../../utils/DisplayUtils";
import { CrowniclesPaginatedEmbed } from "../../messages/CrowniclesPaginatedEmbed";

async function getPacket(interaction: CrowniclesInteraction): Promise<CommandTopPacketReq> {
	await interaction.deferReply();

	const subCommand = interaction.options.getSubcommand();
	const timing = interaction.options.getString("timing") as TopTiming ?? TopTiming.ALL_TIME;
	const page = interaction.options.getInteger("page") ?? undefined;

	return makePacket(CommandTopPacketReq, {
		timing,
		dataType: subCommand === i18n.t("discordBuilder:top.subcommands.score.name", { lng: LANGUAGE.ENGLISH })
			? TopDataType.SCORE
			: subCommand === i18n.t("discordBuilder:top.subcommands.glory.name", { lng: LANGUAGE.ENGLISH })
				? TopDataType.GLORY
				: TopDataType.GUILD,
		page
	});
}

function addTimingOption(builder: SlashCommandSubcommandBuilder): void {
	builder.addStringOption(option => SlashCommandBuilderGenerator.generateOption("top", "timing", option)
		.addChoices(
			{
				name: i18n.t("discordBuilder:top.timings.allTime", { lng: LANGUAGE.ENGLISH }),

				// Discord naming conventions
				// eslint-disable-next-line camelcase
				name_localizations: {
					fr: i18n.t("discordBuilder:top.timings.allTime", { lng: LANGUAGE.FRENCH })
				},
				value: TopTiming.ALL_TIME
			},
			{
				name: i18n.t("discordBuilder:top.timings.weekly", { lng: LANGUAGE.ENGLISH }),

				// Discord naming conventions
				// eslint-disable-next-line camelcase
				name_localizations: {
					fr: i18n.t("discordBuilder:top.timings.weekly", { lng: LANGUAGE.FRENCH })
				},
				value: TopTiming.WEEK
			}
		));
}

function addPageOption(builder: SlashCommandSubcommandBuilder): void {
	builder.addIntegerOption(option => SlashCommandBuilderGenerator.generateOption("top", "page", option)
		.setMinValue(1)
		.setRequired(false));
}

function getScoreSubCommand(): SlashCommandSubcommandBuilder {
	const builder = SlashCommandBuilderGenerator.generateSubCommand("top", "score");
	addTimingOption(builder);
	addPageOption(builder);
	return builder;
}

function getGlorySubCommand(): SlashCommandSubcommandBuilder {
	const builder = SlashCommandBuilderGenerator.generateSubCommand("top", "glory");
	addPageOption(builder);
	return builder;
}

function getGuildSubCommand(): SlashCommandSubcommandBuilder {
	const builder = SlashCommandBuilderGenerator.generateSubCommand("top", "guild");
	addPageOption(builder);
	return builder;
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("top")
		.addSubcommand(getScoreSubCommand())
		.addSubcommand(getGlorySubCommand())
		.addSubcommand(getGuildSubCommand()) as SlashCommandBuilder,
	getPacket,
	mainGuildCommand: false
};

function getBadgeForPosition(rank: number, sameContext: boolean, contextElementPosition?: number): string {
	switch (rank) {
		case 1:
			return CrowniclesIcons.top.badges.first;
		case 2:
			return CrowniclesIcons.top.badges.second;
		case 3:
			return CrowniclesIcons.top.badges.third;
		case 4:
			return CrowniclesIcons.top.badges.fourth;
		case 5:
			return CrowniclesIcons.top.badges.fifth;
		default:
			return sameContext
				? contextElementPosition === rank
					? CrowniclesIcons.top.badges.self
					: CrowniclesIcons.top.badges.sameContext
				: CrowniclesIcons.top.badges.default;
	}
}

function formatScoreAttributes(element: TopElement<TopElementScoreFirstType, number, number>, lng: Language): string {
	let attributes = "";

	if (element.attributes["1"].afk) {
		attributes += `${CrowniclesIcons.top.afk} | `;
	}
	else if (element.attributes["1"].effectId) {
		attributes += `${CrowniclesIcons.effects[element.attributes["1"].effectId]} | `;
	}
	else if (element.attributes["1"].mapType) {
		attributes += `${CrowniclesIcons.mapTypes[element.attributes["1"].mapType]} | `;
	}

	attributes += `\`${DisplayUtils.formatNumber(element.attributes["2"], lng)}\` | \`${i18n.t("commands:top.level", {
		lng,
		level: element.attributes["3"]
	})}\``;

	return attributes;
}

function formatGloryAttributes(element: TopElement<number, number, number>, lng: Language): string {
	return `${
		CrowniclesIcons.leagues[element.attributes["1"].toString(10)]
	} | \`${
		DisplayUtils.formatNumber(element.attributes["2"], lng)
	}\` | \`${
		i18n.t("commands:top.level", {
			lng,
			level: element.attributes["3"]
		})
	}\``;
}

function formatGuildAttributes(element: TopElement<number, number, undefined>, lng: Language): string {
	return `\`${DisplayUtils.formatNumber(element.attributes["1"], lng)}\` | \`${i18n.t("commands:top.level", {
		lng,
		level: element.attributes["2"]
	})}\``;
}

type TopTextKeys = {
	title: string;
	yourRankTitle: string;
	yourRankFirst: string;
	yourRank: string;
	yourRankNone: {
		key: string; replacements: { [key: string]: unknown };
	};
	nobodyInTop: {
		key: string; replacements: { [key: string]: unknown };
	};
	cantBeRanked?: string;
};

const PLAYER_RANK_KEYS = {
	yourRankTitle: "commands:top.yourRankTitle",
	yourRankFirst: "commands:top.yourRankFirst",
	yourRank: "commands:top.yourRank"
} as const;

const GUILD_RANK_KEYS = {
	yourRankTitle: "commands:top.yourRankGuildTitle",
	yourRankFirst: "commands:top.yourRankGuildFirst",
	yourRank: "commands:top.yourRankGuild"
} as const;

function buildYourRankSection<TopElementKind extends TopElement<unknown, unknown, unknown>>(
	packet: CommandTopPacketRes<TopElementKind>,
	textKeys: TopTextKeys,
	lng: Language,
	playerUsername: string
): string {
	let desc = `\n${i18n.t(textKeys.yourRankTitle, { lng })}\n`;

	if (packet.contextRank) {
		const yourRankKey = packet.contextRank === 1 ? textKeys.yourRankFirst : textKeys.yourRank;
		desc += i18n.t(yourRankKey, {
			lng,
			badge: getBadgeForPosition(packet.contextRank, true, packet.contextRank),
			pseudo: playerUsername,
			rank: packet.contextRank,
			total: packet.totalElements,
			count: packet.totalElements
		});
	}
	else if (packet.canBeRanked) {
		desc += i18n.t(textKeys.yourRankNone.key, {
			lng,
			pseudo: playerUsername,
			...textKeys.yourRankNone.replacements
		});
	}
	else if (textKeys.cantBeRanked) {
		desc += i18n.t(textKeys.cantBeRanked, { lng });
	}
	return desc;
}

function buildPageElementsDescription<TopElementKind extends TopElement<unknown, unknown, unknown>>(
	elements: TopElementKind[],
	formatAttributes: (element: TopElementKind, lng: Language) => string,
	lng: Language,
	contextRank: number | undefined,
	overriddenElementTexts?: string[]
): string {
	let desc = "";
	for (let i = 0; i < elements.length; i++) {
		const element = elements[i];
		desc += `${getBadgeForPosition(element.rank, element.sameContext, contextRank)} ${
			overriddenElementTexts ? overriddenElementTexts[i] : element.text
		} | ${formatAttributes(element, lng)}\n`;
	}
	return desc;
}

async function getOverriddenPlayersUsernames<U, V, W>(elements: TopElement<U, V, W>[], lng: Language): Promise<string[]> {
	const req = await KeycloakUtils.getUsersFromIds(keycloakConfig, elements.map(e => e.text));
	const unknownUsername = i18n.t("error:unknownPlayer", { lng });
	if (req.isError) {
		return elements.map(_ => unknownUsername);
	}
	return req.payload.users
		.map(u => u ? escapeUsername(u.attributes.gameUsername[0]) : unknownUsername);
}

function isValidInitialPage(initialPage: number | undefined, pagesCount: number): boolean {
	return initialPage !== undefined && initialPage >= 1 && initialPage <= pagesCount;
}

async function handleGenericTopPacketRes<TopElementKind extends TopElement<unknown, unknown, unknown>>(
	context: PacketContext,
	packet: CommandTopPacketRes<TopElementKind>,
	textKeys: TopTextKeys,
	formatAttributes: (element: TopElementKind, lng: Language) => string,
	needsUsernameResolution: boolean
): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!)!;
	const lng = interaction.userLanguage;
	const playerUsername = await DisplayUtils.getEscapedUsername(context.keycloakId!, lng);
	const pagesCount = Math.ceil(packet.elements.length / packet.elementsPerPage);

	// Determine initial page (0-based)
	let selectedPageIndex = 0;
	if (isValidInitialPage(packet.initialPage, pagesCount)) {
		selectedPageIndex = packet.initialPage! - 1;
	}
	else if (packet.contextRank) {
		selectedPageIndex = Math.ceil(packet.contextRank / packet.elementsPerPage) - 1;
	}

	const yourRankSection = buildYourRankSection(packet, textKeys, lng, playerUsername);

	await new CrowniclesPaginatedEmbed({
		lng,
		pagesCount,
		selectedPageIndex,
		titleBuilder: (pageIndex: number): string => {
			const start = pageIndex * packet.elementsPerPage;
			const end = Math.min(start + packet.elementsPerPage, packet.elements.length);
			const minRank = packet.elements[start].rank;
			const maxRank = packet.elements[end - 1].rank;
			return i18n.t(textKeys.title, {
				lng,
				minRank,
				maxRank
			});
		},
		pageBuilder: async (pageIndex: number): Promise<string> => {
			const start = pageIndex * packet.elementsPerPage;
			const end = Math.min(start + packet.elementsPerPage, packet.elements.length);
			const pageElements = packet.elements.slice(start, end);

			const overriddenTexts = needsUsernameResolution
				? await getOverriddenPlayersUsernames(pageElements, lng)
				: undefined;

			return buildPageElementsDescription(
				pageElements, formatAttributes, lng, packet.contextRank, overriddenTexts
			) + yourRankSection;
		}
	}).send(interaction);
}

export async function handleCommandTopPacketResScore(context: PacketContext, packet: CommandTopPacketResScore): Promise<void> {
	await handleGenericTopPacketRes(context, packet, {
		title: packet.timing === TopTiming.ALL_TIME
			? "commands:top.titleScoreAllTime"
			: "commands:top.titleScoreWeekly",
		...PLAYER_RANK_KEYS,
		yourRankNone: {
			key: "commands:top.yourRankNoneScore",
			replacements: {}
		},
		nobodyInTop: {
			key: "commands:top.nobodyInTopPlayers", replacements: {}
		}
	}, formatScoreAttributes, true);
}

export async function handleCommandTopPacketResGlory(context: PacketContext, packet: CommandTopPacketResGlory): Promise<void> {
	await handleGenericTopPacketRes(context, packet, {
		title: "commands:top.titleGlory",
		...PLAYER_RANK_KEYS,
		yourRankNone: {
			key: "commands:top.yourRankNoneGlory",
			replacements: {
				needFight: packet.needFight,
				count: packet.needFight
			}
		},
		nobodyInTop: {
			key: "commands:top.nobodyInTopGlory",
			replacements: {
				needFight: packet.needFight
			}
		}
	}, formatGloryAttributes, true);
}

export async function handleCommandTopPacketResGuild(context: PacketContext, packet: CommandTopPacketResGuild): Promise<void> {
	await handleGenericTopPacketRes(context, packet, {
		title: "commands:top.titleGuild",
		...GUILD_RANK_KEYS,
		yourRankNone: {
			key: "commands:top.yourRankNoneGuild",
			replacements: {}
		},
		nobodyInTop: {
			key: "commands:top.nobodyInTopGuilds",
			replacements: {}
		},
		cantBeRanked: "commands:top.noGuild"
	}, formatGuildAttributes, false);
}

export async function handleCommandTopPlayersEmptyPacket(context: PacketContext, packet: CommandTopPlayersEmptyPacket): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!)!;

	await interaction.editReply({
		embeds: [
			new CrowniclesErrorEmbed(interaction.user, context, interaction,
				i18n.t(packet.needFight ? "commands:top.nobodyInTopGlory" : "commands:top.nobodyInTopPlayers", {
					lng: interaction.userLanguage, needFight: packet.needFight ? packet.needFight : 0
				}))
		]
	});
}

export async function handleCommandTopGuildsEmptyPacket(context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!)!;

	await interaction.editReply({
		embeds: [new CrowniclesErrorEmbed(interaction.user, context, interaction, i18n.t("commands:top.nobodyInTopGuilds", { lng: interaction.userLanguage }))]
	});
}
