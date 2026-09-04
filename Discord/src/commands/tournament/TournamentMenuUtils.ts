import {
	ActionRowBuilder, ButtonBuilder, ContainerBuilder, Message, MessageComponentInteraction,
	SeparatorBuilder, SeparatorSpacingSize, TextDisplayBuilder
} from "discord.js";
import {
	CrowniclesPacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	TournamentStatuses, type TournamentMenuSummary
} from "../../../../Lib/src/types/Tournament";
import { Constants } from "../../../../Lib/src/constants/Constants";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import { Language } from "../../../../Lib/src/Language";
import { finishInTimeDisplay } from "../../../../Lib/src/utils/TimeUtils";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { DiscordCache } from "../../bot/DiscordCache";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import {
	CrowniclesNestedMenu, CrowniclesNestedMenuCollectorFactory, CrowniclesNestedMenus
} from "../../messages/CrowniclesNestedMenus";
import { PacketUtils } from "../../utils/PacketUtils";
import { sendInteractionNotForYou } from "../../utils/ErrorUtils";
import { StringUtils } from "../../utils/StringUtils";
import i18n from "../../translations/i18n";
import { addCitySection } from "../player/report/ReportCityMenu";
import { ReportCityButtonStyles } from "../player/report/ReportCityMenuConstants";

export type TournamentMenuContext = {
	context: PacketContext;
	interaction: CrowniclesInteraction;
	collectorTime: number;
};

export const TOURNAMENT_MENU_IDS = {
	ADMIN_ROOT: "TOURNAMENT_ADMIN_ROOT",
	ADMIN_CREATE: "TOURNAMENT_ADMIN_CREATE",
	ADMIN_CANCEL: "TOURNAMENT_ADMIN_CANCEL",
	ADMIN_CANCEL_SELECT_PREFIX: "TOURNAMENT_ADMIN_CANCEL_SELECT_",
	ADMIN_CANCEL_CONFIRM: "TOURNAMENT_ADMIN_CANCEL_CONFIRM",
	OWNER_ROOT: "TOURNAMENT_OWNER_ROOT",
	OWNER_RESUME: "TOURNAMENT_OWNER_RESUME",
	OWNER_RESUME_SELECT_PREFIX: "TOURNAMENT_OWNER_RESUME_SELECT_",
	OWNER_RESUME_CONFIRM: "TOURNAMENT_OWNER_RESUME_CONFIRM",
	CREATE_REGISTRATION_PREFIX: "TOURNAMENT_CREATE_REGISTRATION_",
	CREATE_COMBAT_PREFIX: "TOURNAMENT_CREATE_COMBAT_",
	CREATE_LEVEL_MODE_PREFIX: "TOURNAMENT_CREATE_LEVEL_MODE_",
	CREATE_LEVEL_CAP_PREFIX: "TOURNAMENT_CREATE_LEVEL_CAP_",
	CREATE_CONFIRM: "TOURNAMENT_CREATE_CONFIRM",
	BACK: "TOURNAMENT_MENU_BACK",
	CLOSE: "TOURNAMENT_MENU_CLOSE"
} as const;

export const TOURNAMENT_DURATION_OPTIONS = [
	1,
	3,
	7
] as const;

export const TOURNAMENT_LEVEL_CAP_OPTIONS = [
	8,
	25,
	50,
	75,
	100,
	150,
	250,
	500,
	1000
] as const;

type TournamentMenuHandler = (
	componentInteraction: MessageComponentInteraction,
	nestedMenus: CrowniclesNestedMenus
) => Promise<void>;

export type TournamentSelectionMenuOptions = {
	context: TournamentMenuContext;
	tournaments: TournamentMenuSummary[];
	titleKey: string;
	descriptionKey: string;
	emptyDescriptionKey?: string;
	selectPrefix: string;
	backMenuId: string;
	confirmationMenuId: string;
	buildConfirmationMenu: (tournament: TournamentMenuSummary) => CrowniclesNestedMenu;
};

export type TournamentConfirmationMenuOptions = {
	context: TournamentMenuContext;
	tournament: TournamentMenuSummary;
	titleKey: string;
	descriptionKey: string;
	confirmCustomId: string;
	confirmLabelKey: string;
	confirmEmoji: string;
	confirmStyle: typeof ReportCityButtonStyles[keyof typeof ReportCityButtonStyles];
	backMenuId: string;
	createPacket: (tournamentId: number) => CrowniclesPacket;
};

export function getInteraction(context: PacketContext): CrowniclesInteraction | null {
	return context.discord?.interaction ? DiscordCache.getInteraction(context.discord.interaction) : null;
}

export function createTournamentMenuContext(context: PacketContext): TournamentMenuContext | null {
	const interaction = getInteraction(context);
	if (!interaction) {
		return null;
	}
	return {
		context,
		interaction,
		collectorTime: Constants.MESSAGES.COLLECTOR_TIME
	};
}

export function createContainer(title: string, description: string): ContainerBuilder {
	const container = new ContainerBuilder();
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(StringUtils.formatHeader(title)),
		new TextDisplayBuilder().setContent(description)
	);
	return container;
}

export function addSeparator(container: ContainerBuilder): void {
	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
}

export function addMenuNavigation(
	container: ContainerBuilder,
	backMenuId: string | undefined,
	lng: Language
): void {
	addSeparator(container);
	const row = new ActionRowBuilder<ButtonBuilder>();
	if (backMenuId) {
		row.addComponents(new ButtonBuilder()
			.setCustomId(TOURNAMENT_MENU_IDS.BACK)
			.setLabel(i18n.t("commands:tournament.menu.back", { lng }))
			.setEmoji(CrowniclesIcons.collectors.previousPage)
			.setStyle(ReportCityButtonStyles.BACK));
	}
	row.addComponents(new ButtonBuilder()
		.setCustomId(TOURNAMENT_MENU_IDS.CLOSE)
		.setLabel(i18n.t("commands:tournament.menu.close", { lng }))
		.setEmoji(CrowniclesIcons.collectors.refuse)
		.setStyle(ReportCityButtonStyles.STAY));
	container.addActionRowComponents(row);
}

export function createMenuCollector(
	context: TournamentMenuContext,
	handler: TournamentMenuHandler
): CrowniclesNestedMenuCollectorFactory {
	return (nestedMenus, message) => {
		const collector = message.createMessageComponentCollector({ time: context.collectorTime });
		collector.on("collect", async componentInteraction => {
			if (componentInteraction.user.id !== context.interaction.user.id) {
				await sendInteractionNotForYou(componentInteraction.user, componentInteraction, context.interaction.userLanguage);
				return;
			}
			try {
				await handler(componentInteraction, nestedMenus);
			}
			catch (error) {
				CrowniclesLogger.errorWithObj("Tournament menu interaction failed", error);
			}
		});
		return collector;
	};
}

export async function sendMenu(
	context: TournamentMenuContext,
	mainMenu: CrowniclesNestedMenu,
	menus: Map<string, CrowniclesNestedMenu>
): Promise<void> {
	const timeoutCollectorReference: {
		collector?: ReturnType<Message["createReactionCollector"]>;
	} = {};
	const nestedMenus = new CrowniclesNestedMenus(mainMenu, menus, () => {
		timeoutCollectorReference.collector?.resetTimer({ time: context.collectorTime });
	});
	const message = await nestedMenus.send(context.interaction);
	timeoutCollectorReference.collector = message.createReactionCollector({ time: context.collectorTime });
	timeoutCollectorReference.collector.on("end", async () => {
		try {
			await nestedMenus.stopCurrentCollector();
		}
		catch (error) {
			CrowniclesLogger.errorWithObj("Tournament menu cleanup failed", error);
		}
	});
}

export async function changeMenu(
	componentInteraction: MessageComponentInteraction,
	nestedMenus: CrowniclesNestedMenus,
	menuId: string
): Promise<void> {
	await componentInteraction.deferUpdate();
	await nestedMenus.changeMenu(menuId);
}

export async function closeMenu(
	componentInteraction: MessageComponentInteraction,
	nestedMenus: CrowniclesNestedMenus
): Promise<void> {
	await componentInteraction.deferUpdate();
	await nestedMenus.stopCurrentCollector();
}

export async function sendPacketFromMenu(
	componentInteraction: MessageComponentInteraction,
	nestedMenus: CrowniclesNestedMenus,
	context: PacketContext,
	packet: CrowniclesPacket
): Promise<void> {
	await componentInteraction.deferUpdate();
	if (!nestedMenus.beginMessageHandoff()) {
		return;
	}
	nestedMenus.confirmMessageHandoff();
	await nestedMenus.stopCurrentCollector();
	PacketUtils.sendPacketToBackend(context, packet);
}

export function getTournamentSummaryDescription(summary: TournamentMenuSummary, lng: Language): string {
	const phaseEnd = summary.status === TournamentStatuses.REGISTRATION
		? finishInTimeDisplay(new Date(summary.registrationEndsAt))
		: summary.status === TournamentStatuses.PAUSED
			? i18n.t("commands:tournament.menu.paused", { lng })
			: finishInTimeDisplay(new Date(summary.combatEndsAt));
	return i18n.t("commands:tournament.menu.tournamentSummary", {
		lng,
		status: i18n.t(`commands:tournament.statuses.${summary.status}`, { lng }),
		participantCount: summary.participantCount,
		channel: `<#${summary.discordChannelId}>`,
		phaseEnd
	});
}

export function getDayLabel(days: number, lng: Language): string {
	return i18n.t(days === 1 ? "commands:tournament.menu.day" : "commands:tournament.menu.days", {
		lng,
		count: days
	});
}

export function parseMenuId(customId: string, prefix: string): number {
	return Number.parseInt(customId.slice(prefix.length), 10);
}

export function buildTournamentSelectionMenu(options: TournamentSelectionMenuOptions): CrowniclesNestedMenu {
	const {
		context, tournaments, titleKey, descriptionKey, emptyDescriptionKey, selectPrefix, backMenuId,
		confirmationMenuId, buildConfirmationMenu
	} = options;
	const lng = context.interaction.userLanguage;
	const container = createContainer(
		i18n.t(titleKey, { lng }),
		i18n.t(descriptionKey, { lng })
	);
	if (tournaments.length === 0 && emptyDescriptionKey) {
		container.addTextDisplayComponents(new TextDisplayBuilder().setContent(i18n.t(emptyDescriptionKey, { lng })));
	}
	for (const tournament of tournaments) {
		addSeparator(container);
		addCitySection({
			container,
			emote: CrowniclesIcons.collectors.previousPage,
			title: i18n.t("commands:tournament.menu.tournamentLabel", {
				lng,
				tournamentId: tournament.id
			}),
			description: getTournamentSummaryDescription(tournament, lng),
			customId: `${selectPrefix}${tournament.id}`,
			buttonLabel: i18n.t("commands:tournament.menu.chooseButton", { lng }),
			buttonStyle: ReportCityButtonStyles.OPTION
		});
	}
	addMenuNavigation(container, backMenuId, lng);
	return {
		containers: [container],
		createCollector: createMenuCollector(context, async (componentInteraction, nestedMenus) => {
			if (!componentInteraction.isButton()) {
				return;
			}
			if (componentInteraction.customId === TOURNAMENT_MENU_IDS.BACK) {
				await changeMenu(componentInteraction, nestedMenus, backMenuId);
				return;
			}
			if (componentInteraction.customId === TOURNAMENT_MENU_IDS.CLOSE) {
				await closeMenu(componentInteraction, nestedMenus);
				return;
			}
			const tournamentId = parseMenuId(componentInteraction.customId, selectPrefix);
			const tournament = tournaments.find(candidate => candidate.id === tournamentId);
			if (!tournament) {
				return;
			}
			nestedMenus.registerMenu(confirmationMenuId, buildConfirmationMenu(tournament));
			await changeMenu(componentInteraction, nestedMenus, confirmationMenuId);
		})
	};
}

export function buildTournamentConfirmationMenu(options: TournamentConfirmationMenuOptions): CrowniclesNestedMenu {
	const {
		context, tournament, titleKey, descriptionKey, confirmLabelKey, confirmEmoji,
		confirmStyle, backMenuId, createPacket, confirmCustomId
	} = options;
	const lng = context.interaction.userLanguage;
	const container = createContainer(
		i18n.t(titleKey, { lng }),
		i18n.t(descriptionKey, {
			lng,
			tournament: i18n.t("commands:tournament.menu.tournamentLabel", {
				lng,
				tournamentId: tournament.id
			}),
			channel: `<#${tournament.discordChannelId}>`
		})
	);
	addCitySection({
		container,
		emote: confirmEmoji,
		text: getTournamentSummaryDescription(tournament, lng),
		customId: confirmCustomId,
		buttonLabel: i18n.t(confirmLabelKey, { lng }),
		buttonStyle: confirmStyle
	});
	addMenuNavigation(container, backMenuId, lng);
	return {
		containers: [container],
		createCollector: createMenuCollector(context, async (componentInteraction, nestedMenus) => {
			if (!componentInteraction.isButton()) {
				return;
			}
			if (componentInteraction.customId === confirmCustomId) {
				await sendPacketFromMenu(
					componentInteraction,
					nestedMenus,
					context.context,
					createPacket(tournament.id)
				);
				return;
			}
			if (componentInteraction.customId === TOURNAMENT_MENU_IDS.BACK) {
				await changeMenu(componentInteraction, nestedMenus, backMenuId);
				return;
			}
			if (componentInteraction.customId === TOURNAMENT_MENU_IDS.CLOSE) {
				await closeMenu(componentInteraction, nestedMenus);
			}
		})
	};
}
