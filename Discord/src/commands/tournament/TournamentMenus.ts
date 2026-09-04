import {
	ActionRowBuilder, ButtonBuilder, ContainerBuilder, Message, MessageComponentInteraction,
	SeparatorBuilder, SeparatorSpacingSize,
	TextDisplayBuilder
} from "discord.js";
import {
	CommandTournamentAdminMenuPacketRes, CommandTournamentCancelPacketReq,
	CommandTournamentCreatePacketReq, CommandTournamentGenerateCodePacketReq,
	CommandTournamentOwnerMenuPacketRes, CommandTournamentResumePacketReq
} from "../../../../Lib/src/packets/commands/CommandTournamentPacket";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	TournamentLevelLimitModes, TournamentStatuses, type TournamentLevelLimitMode,
	type TournamentMenuSummary
} from "../../../../Lib/src/types/Tournament";
import { Constants } from "../../../../Lib/src/constants/Constants";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import { finishInTimeDisplay } from "../../../../Lib/src/utils/TimeUtils";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { DiscordCache } from "../../bot/DiscordCache";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import {
	CrowniclesNestedMenu, CrowniclesNestedMenuCollectorFactory, CrowniclesNestedMenus
} from "../../messages/CrowniclesNestedMenus";
import { addButtonToRow } from "../../utils/DiscordCollectorUtils";
import { PacketUtils } from "../../utils/PacketUtils";
import { sendInteractionNotForYou } from "../../utils/ErrorUtils";
import { StringUtils } from "../../utils/StringUtils";
import i18n from "../../translations/i18n";
import { addCitySection } from "../player/report/ReportCityMenu";
import { ReportCityButtonStyles } from "../player/report/ReportCityMenuConstants";

type TournamentMenuContext = {
	context: PacketContext;
	interaction: CrowniclesInteraction;
	collectorTime: number;
};

type TournamentCreationMenuState = {
	registrationDays?: number;
	combatDays?: number;
	levelLimitMode: TournamentLevelLimitMode;
	levelCap?: number;
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

const TOURNAMENT_DURATION_OPTIONS = [
	1,
	3,
	7
] as const;
const TOURNAMENT_LEVEL_CAP_OPTIONS = [
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

function getInteraction(context: PacketContext): CrowniclesInteraction | null {
	return context.discord?.interaction ? DiscordCache.getInteraction(context.discord.interaction) : null;
}

function getLanguage(context: TournamentMenuContext): typeof context.interaction.userLanguage {
	return context.interaction.userLanguage;
}

function createContainer(title: string, description: string): ContainerBuilder {
	const container = new ContainerBuilder();
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(StringUtils.formatHeader(title)),
		new TextDisplayBuilder().setContent(description)
	);
	return container;
}

function addSeparator(container: ContainerBuilder): void {
	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
}

function addMenuNavigation(container: ContainerBuilder, backMenuId?: string, lng?: TournamentMenuContext["interaction"]["userLanguage"]): void {
	if (!lng) {
		return;
	}
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

function createMenuCollector(context: TournamentMenuContext, handler: TournamentMenuHandler): CrowniclesNestedMenuCollectorFactory {
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

async function sendMenu(
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

async function changeMenu(
	componentInteraction: MessageComponentInteraction,
	nestedMenus: CrowniclesNestedMenus,
	menuId: string
): Promise<void> {
	await componentInteraction.deferUpdate();
	await nestedMenus.changeMenu(menuId);
}

async function closeMenu(
	componentInteraction: MessageComponentInteraction,
	nestedMenus: CrowniclesNestedMenus
): Promise<void> {
	await componentInteraction.deferUpdate();
	await nestedMenus.stopCurrentCollector();
}

async function sendPacketFromMenu(
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

function getStatusLabel(summary: TournamentMenuSummary, lng: TournamentMenuContext["interaction"]["userLanguage"]): string {
	return i18n.t(`commands:tournament.statuses.${summary.status}`, { lng });
}

function getDayLabel(days: number, lng: TournamentMenuContext["interaction"]["userLanguage"]): string {
	return i18n.t(days === 1 ? "commands:tournament.menu.day" : "commands:tournament.menu.days", {
		lng,
		count: days
	});
}

function getTournamentSummaryDescription(summary: TournamentMenuSummary, lng: TournamentMenuContext["interaction"]["userLanguage"]): string {
	const phaseEnd = summary.status === TournamentStatuses.REGISTRATION
		? summary.registrationEndsAt
		: summary.combatEndsAt;
	return i18n.t("commands:tournament.menu.tournamentSummary", {
		lng,
		status: getStatusLabel(summary, lng),
		participantCount: summary.participantCount,
		channel: `<#${summary.discordChannelId}>`,
		phaseEnd: finishInTimeDisplay(new Date(phaseEnd))
	});
}

function buildAdminRootMenu(context: TournamentMenuContext, packet: CommandTournamentAdminMenuPacketRes): CrowniclesNestedMenu {
	const lng = getLanguage(context);
	const container = createContainer(
		i18n.t("commands:tournament.menu.adminTitle", { lng }),
		i18n.t("commands:tournament.menu.adminDescription", {
			lng,
			activeCount: packet.tournaments.length
		})
	);
	addCitySection({
		container,
		emote: CrowniclesIcons.collectors.accept,
		title: i18n.t("commands:tournament.menu.createTitle", { lng }),
		description: packet.hasAvailableCode
			? i18n.t("commands:tournament.menu.createDescription", { lng })
			: i18n.t("commands:tournament.menu.createUnavailable", { lng }),
		customId: TOURNAMENT_MENU_IDS.ADMIN_CREATE,
		buttonLabel: i18n.t("commands:tournament.menu.createButton", { lng }),
		buttonStyle: ReportCityButtonStyles.NAVIGATE,
		disabled: !packet.hasAvailableCode
	});
	addCitySection({
		container,
		emote: CrowniclesIcons.collectors.refuse,
		title: i18n.t("commands:tournament.menu.cancelTitle", { lng }),
		description: packet.tournaments.length > 0
			? i18n.t("commands:tournament.menu.cancelDescription", { lng })
			: i18n.t("commands:tournament.menu.cancelUnavailable", { lng }),
		customId: TOURNAMENT_MENU_IDS.ADMIN_CANCEL,
		buttonLabel: i18n.t("commands:tournament.menu.cancelButton", { lng }),
		buttonStyle: ReportCityButtonStyles.DESTRUCTIVE,
		disabled: packet.tournaments.length === 0
	});
	addMenuNavigation(container, undefined, lng);
	return {
		containers: [container],
		createCollector: createMenuCollector(context, async (componentInteraction, nestedMenus) => {
			if (!componentInteraction.isButton()) {
				return;
			}
			if (componentInteraction.customId === TOURNAMENT_MENU_IDS.ADMIN_CREATE) {
				await changeMenu(componentInteraction, nestedMenus, TOURNAMENT_MENU_IDS.ADMIN_CREATE);
				return;
			}
			if (componentInteraction.customId === TOURNAMENT_MENU_IDS.ADMIN_CANCEL) {
				await changeMenu(componentInteraction, nestedMenus, TOURNAMENT_MENU_IDS.ADMIN_CANCEL);
				return;
			}
			if (componentInteraction.customId === TOURNAMENT_MENU_IDS.CLOSE) {
				await closeMenu(componentInteraction, nestedMenus);
			}
		})
	};
}

function buildAdminCancelMenu(context: TournamentMenuContext, tournaments: TournamentMenuSummary[]): CrowniclesNestedMenu {
	const lng = getLanguage(context);
	const container = createContainer(
		i18n.t("commands:tournament.menu.cancelListTitle", { lng }),
		i18n.t("commands:tournament.menu.cancelListDescription", { lng })
	);
	if (tournaments.length === 0) {
		container.addTextDisplayComponents(new TextDisplayBuilder().setContent(i18n.t("commands:tournament.menu.cancelUnavailable", { lng })));
	}
	for (const tournament of tournaments) {
		addSeparator(container);
		addCitySection({
			container,
			emote: CrowniclesIcons.collectors.refuse,
			title: i18n.t("commands:tournament.menu.tournamentLabel", {
				lng,
				tournamentId: tournament.id
			}),
			description: getTournamentSummaryDescription(tournament, lng),
			customId: `${TOURNAMENT_MENU_IDS.ADMIN_CANCEL_SELECT_PREFIX}${tournament.id}`,
			buttonLabel: i18n.t("commands:tournament.menu.chooseButton", { lng }),
			buttonStyle: ReportCityButtonStyles.OPTION
		});
	}
	addMenuNavigation(container, TOURNAMENT_MENU_IDS.ADMIN_ROOT, lng);
	return {
		containers: [container],
		createCollector: createMenuCollector(context, async (componentInteraction, nestedMenus) => {
			if (!componentInteraction.isButton()) {
				return;
			}
			if (componentInteraction.customId === TOURNAMENT_MENU_IDS.BACK) {
				await changeMenu(componentInteraction, nestedMenus, TOURNAMENT_MENU_IDS.ADMIN_ROOT);
				return;
			}
			if (componentInteraction.customId === TOURNAMENT_MENU_IDS.CLOSE) {
				await closeMenu(componentInteraction, nestedMenus);
				return;
			}
			const tournamentId = parseMenuId(componentInteraction.customId, TOURNAMENT_MENU_IDS.ADMIN_CANCEL_SELECT_PREFIX);
			const tournament = tournaments.find(candidate => candidate.id === tournamentId);
			if (tournament) {
				nestedMenus.registerMenu(
					TOURNAMENT_MENU_IDS.ADMIN_CANCEL_CONFIRM,
					buildAdminCancelConfirmationMenu(context, tournament)
				);
				await changeMenu(componentInteraction, nestedMenus, TOURNAMENT_MENU_IDS.ADMIN_CANCEL_CONFIRM);
			}
		})
	};
}

function buildAdminCancelConfirmationMenu(context: TournamentMenuContext, tournament: TournamentMenuSummary): CrowniclesNestedMenu {
	const lng = getLanguage(context);
	const container = createContainer(
		i18n.t("commands:tournament.menu.cancelConfirmTitle", { lng }),
		i18n.t("commands:tournament.menu.cancelConfirmDescription", {
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
		emote: CrowniclesIcons.collectors.refuse,
		text: getTournamentSummaryDescription(tournament, lng),
		customId: TOURNAMENT_MENU_IDS.ADMIN_CANCEL_CONFIRM,
		buttonLabel: i18n.t("commands:tournament.menu.cancelConfirmButton", { lng }),
		buttonStyle: ReportCityButtonStyles.DESTRUCTIVE
	});
	addMenuNavigation(container, TOURNAMENT_MENU_IDS.ADMIN_CANCEL, lng);
	return {
		containers: [container],
		createCollector: createMenuCollector(context, async (componentInteraction, nestedMenus) => {
			if (!componentInteraction.isButton()) {
				return;
			}
			if (componentInteraction.customId === TOURNAMENT_MENU_IDS.ADMIN_CANCEL_CONFIRM) {
				await sendPacketFromMenu(
					componentInteraction,
					nestedMenus,
					context.context,
					makePacket(CommandTournamentCancelPacketReq, { tournamentId: tournament.id })
				);
				return;
			}
			if (componentInteraction.customId === TOURNAMENT_MENU_IDS.BACK) {
				await changeMenu(componentInteraction, nestedMenus, TOURNAMENT_MENU_IDS.ADMIN_CANCEL);
				return;
			}
			if (componentInteraction.customId === TOURNAMENT_MENU_IDS.CLOSE) {
				await closeMenu(componentInteraction, nestedMenus);
			}
		})
	};
}

function addDurationChoices(
	container: ContainerBuilder,
	context: TournamentMenuContext,
	labelKey: string,
	selectedDays: number | undefined,
	customIdPrefix: string
): void {
	const lng = getLanguage(context);
	addSeparator(container);
	container.addTextDisplayComponents(new TextDisplayBuilder().setContent(i18n.t(labelKey, { lng })));
	const row = new ActionRowBuilder<ButtonBuilder>();
	for (const days of TOURNAMENT_DURATION_OPTIONS) {
		row.addComponents(new ButtonBuilder()
			.setCustomId(`${customIdPrefix}${days}`)
			.setLabel(getDayLabel(days, lng))
			.setStyle(days === selectedDays ? ReportCityButtonStyles.CONFIRM : ReportCityButtonStyles.OPTION));
	}
	container.addActionRowComponents(row);
}

function getLevelModeLabel(mode: TournamentLevelLimitMode, context: TournamentMenuContext): string {
	return i18n.t(`commands:tournament.menu.levelMode${mode.charAt(0).toUpperCase()}${mode.slice(1)}`, {
		lng: getLanguage(context)
	});
}

function isCustomLevelMode(mode: TournamentLevelLimitMode): boolean {
	return mode === TournamentLevelLimitModes.CAP || mode === TournamentLevelLimitModes.REJECT;
}

function isCreationComplete(state: TournamentCreationMenuState): boolean {
	return state.registrationDays !== undefined
		&& state.combatDays !== undefined
		&& (!isCustomLevelMode(state.levelLimitMode) || state.levelCap !== undefined);
}

function buildAdminCreateMenu(context: TournamentMenuContext, state: TournamentCreationMenuState): CrowniclesNestedMenu {
	const lng = getLanguage(context);
	const container = createContainer(
		i18n.t("commands:tournament.menu.createWizardTitle", { lng }),
		i18n.t("commands:tournament.menu.createWizardDescription", { lng })
	);
	addDurationChoices(
		container,
		context,
		"commands:tournament.menu.registrationDuration",
		state.registrationDays,
		TOURNAMENT_MENU_IDS.CREATE_REGISTRATION_PREFIX
	);
	addDurationChoices(
		container,
		context,
		"commands:tournament.menu.combatDuration",
		state.combatDays,
		TOURNAMENT_MENU_IDS.CREATE_COMBAT_PREFIX
	);
	addSeparator(container);
	container.addTextDisplayComponents(new TextDisplayBuilder().setContent(i18n.t("commands:tournament.menu.levelMode", { lng })));
	const levelModeRow = new ActionRowBuilder<ButtonBuilder>();
	for (const mode of Object.values(TournamentLevelLimitModes)) {
		levelModeRow.addComponents(new ButtonBuilder()
			.setCustomId(`${TOURNAMENT_MENU_IDS.CREATE_LEVEL_MODE_PREFIX}${mode}`)
			.setLabel(getLevelModeLabel(mode, context))
			.setStyle(mode === state.levelLimitMode ? ReportCityButtonStyles.CONFIRM : ReportCityButtonStyles.OPTION));
	}
	container.addActionRowComponents(levelModeRow);
	if (isCustomLevelMode(state.levelLimitMode)) {
		addSeparator(container);
		container.addTextDisplayComponents(new TextDisplayBuilder().setContent(i18n.t("commands:tournament.menu.levelCap", { lng })));
		const levelCapRows = [new ActionRowBuilder<ButtonBuilder>()];
		for (const levelCap of TOURNAMENT_LEVEL_CAP_OPTIONS) {
			addButtonToRow(levelCapRows, new ButtonBuilder()
				.setCustomId(`${TOURNAMENT_MENU_IDS.CREATE_LEVEL_CAP_PREFIX}${levelCap}`)
				.setLabel(levelCap.toString())
				.setStyle(levelCap === state.levelCap ? ReportCityButtonStyles.CONFIRM : ReportCityButtonStyles.OPTION));
		}
		container.addActionRowComponents(...levelCapRows);
	}
	addSeparator(container);
	const actionRow = new ActionRowBuilder<ButtonBuilder>()
		.addComponents(new ButtonBuilder()
			.setCustomId(TOURNAMENT_MENU_IDS.CREATE_CONFIRM)
			.setLabel(i18n.t("commands:tournament.menu.createConfirmButton", { lng }))
			.setEmoji(CrowniclesIcons.collectors.accept)
			.setStyle(ReportCityButtonStyles.CONFIRM)
			.setDisabled(!isCreationComplete(state)));
	container.addActionRowComponents(actionRow);
	addMenuNavigation(container, TOURNAMENT_MENU_IDS.ADMIN_ROOT, lng);
	return {
		containers: [container],
		createCollector: createMenuCollector(context, async (componentInteraction, nestedMenus) => {
			if (!componentInteraction.isButton()) {
				return;
			}
			const { customId } = componentInteraction;
			if (customId.startsWith(TOURNAMENT_MENU_IDS.CREATE_REGISTRATION_PREFIX)) {
				state.registrationDays = parseMenuId(customId, TOURNAMENT_MENU_IDS.CREATE_REGISTRATION_PREFIX);
				nestedMenus.registerMenu(TOURNAMENT_MENU_IDS.ADMIN_CREATE, buildAdminCreateMenu(context, state));
				await changeMenu(componentInteraction, nestedMenus, TOURNAMENT_MENU_IDS.ADMIN_CREATE);
				return;
			}
			if (customId.startsWith(TOURNAMENT_MENU_IDS.CREATE_COMBAT_PREFIX)) {
				state.combatDays = parseMenuId(customId, TOURNAMENT_MENU_IDS.CREATE_COMBAT_PREFIX);
				nestedMenus.registerMenu(TOURNAMENT_MENU_IDS.ADMIN_CREATE, buildAdminCreateMenu(context, state));
				await changeMenu(componentInteraction, nestedMenus, TOURNAMENT_MENU_IDS.ADMIN_CREATE);
				return;
			}
			if (customId.startsWith(TOURNAMENT_MENU_IDS.CREATE_LEVEL_MODE_PREFIX)) {
				state.levelLimitMode = customId.slice(TOURNAMENT_MENU_IDS.CREATE_LEVEL_MODE_PREFIX.length) as TournamentLevelLimitMode;
				if (!isCustomLevelMode(state.levelLimitMode)) {
					state.levelCap = undefined;
				}
				nestedMenus.registerMenu(TOURNAMENT_MENU_IDS.ADMIN_CREATE, buildAdminCreateMenu(context, state));
				await changeMenu(componentInteraction, nestedMenus, TOURNAMENT_MENU_IDS.ADMIN_CREATE);
				return;
			}
			if (customId.startsWith(TOURNAMENT_MENU_IDS.CREATE_LEVEL_CAP_PREFIX)) {
				state.levelCap = parseMenuId(customId, TOURNAMENT_MENU_IDS.CREATE_LEVEL_CAP_PREFIX);
				nestedMenus.registerMenu(TOURNAMENT_MENU_IDS.ADMIN_CREATE, buildAdminCreateMenu(context, state));
				await changeMenu(componentInteraction, nestedMenus, TOURNAMENT_MENU_IDS.ADMIN_CREATE);
				return;
			}
			if (customId === TOURNAMENT_MENU_IDS.CREATE_CONFIRM && isCreationComplete(state)) {
				await sendPacketFromMenu(
					componentInteraction,
					nestedMenus,
					context.context,
					makePacket(CommandTournamentCreatePacketReq, {
						registrationDays: state.registrationDays!,
						combatDays: state.combatDays!,
						levelLimitMode: state.levelLimitMode,
						...state.levelCap !== undefined ? { levelCap: state.levelCap } : {}
					})
				);
				return;
			}
			if (customId === TOURNAMENT_MENU_IDS.BACK) {
				await changeMenu(componentInteraction, nestedMenus, TOURNAMENT_MENU_IDS.ADMIN_ROOT);
				return;
			}
			if (customId === TOURNAMENT_MENU_IDS.CLOSE) {
				await closeMenu(componentInteraction, nestedMenus);
			}
		})
	};
}

function buildOwnerRootMenu(context: TournamentMenuContext, packet: CommandTournamentOwnerMenuPacketRes): CrowniclesNestedMenu {
	const lng = getLanguage(context);
	const container = createContainer(
		i18n.t("commands:tournament.menu.ownerTitle", { lng }),
		i18n.t("commands:tournament.menu.ownerDescription", { lng })
	);
	addCitySection({
		container,
		emote: CrowniclesIcons.collectors.accept,
		title: i18n.t("commands:tournament.menu.codeTitle", { lng }),
		description: i18n.t("commands:tournament.menu.codeDescription", { lng }),
		customId: TOURNAMENT_MENU_IDS.OWNER_ROOT,
		buttonLabel: i18n.t("commands:tournament.menu.codeButton", { lng }),
		buttonStyle: ReportCityButtonStyles.NAVIGATE
	});
	addCitySection({
		container,
		emote: CrowniclesIcons.collectors.previousPage,
		title: i18n.t("commands:tournament.menu.resumeTitle", { lng }),
		description: packet.pausedTournaments.length > 0
			? i18n.t("commands:tournament.menu.resumeDescription", { lng })
			: i18n.t("commands:tournament.menu.resumeUnavailable", { lng }),
		customId: TOURNAMENT_MENU_IDS.OWNER_RESUME,
		buttonLabel: i18n.t("commands:tournament.menu.resumeButton", { lng }),
		buttonStyle: ReportCityButtonStyles.NAVIGATE,
		disabled: packet.pausedTournaments.length === 0
	});
	addMenuNavigation(container, undefined, lng);
	return {
		containers: [container],
		createCollector: createMenuCollector(context, async (componentInteraction, nestedMenus) => {
			if (!componentInteraction.isButton()) {
				return;
			}
			if (componentInteraction.customId === TOURNAMENT_MENU_IDS.OWNER_ROOT) {
				await sendPacketFromMenu(
					componentInteraction,
					nestedMenus,
					context.context,
					makePacket(CommandTournamentGenerateCodePacketReq, {})
				);
				return;
			}
			if (componentInteraction.customId === TOURNAMENT_MENU_IDS.OWNER_RESUME) {
				await changeMenu(componentInteraction, nestedMenus, TOURNAMENT_MENU_IDS.OWNER_RESUME);
				return;
			}
			if (componentInteraction.customId === TOURNAMENT_MENU_IDS.CLOSE) {
				await closeMenu(componentInteraction, nestedMenus);
			}
		})
	};
}

function buildOwnerResumeMenu(context: TournamentMenuContext, tournaments: TournamentMenuSummary[]): CrowniclesNestedMenu {
	const lng = getLanguage(context);
	const container = createContainer(
		i18n.t("commands:tournament.menu.resumeListTitle", { lng }),
		i18n.t("commands:tournament.menu.resumeListDescription", { lng })
	);
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
			customId: `${TOURNAMENT_MENU_IDS.OWNER_RESUME_SELECT_PREFIX}${tournament.id}`,
			buttonLabel: i18n.t("commands:tournament.menu.chooseButton", { lng }),
			buttonStyle: ReportCityButtonStyles.OPTION
		});
	}
	addMenuNavigation(container, TOURNAMENT_MENU_IDS.OWNER_ROOT, lng);
	return {
		containers: [container],
		createCollector: createMenuCollector(context, async (componentInteraction, nestedMenus) => {
			if (!componentInteraction.isButton()) {
				return;
			}
			if (componentInteraction.customId === TOURNAMENT_MENU_IDS.BACK) {
				await changeMenu(componentInteraction, nestedMenus, TOURNAMENT_MENU_IDS.OWNER_ROOT);
				return;
			}
			if (componentInteraction.customId === TOURNAMENT_MENU_IDS.CLOSE) {
				await closeMenu(componentInteraction, nestedMenus);
				return;
			}
			const tournamentId = parseMenuId(componentInteraction.customId, TOURNAMENT_MENU_IDS.OWNER_RESUME_SELECT_PREFIX);
			const tournament = tournaments.find(candidate => candidate.id === tournamentId);
			if (tournament) {
				nestedMenus.registerMenu(
					TOURNAMENT_MENU_IDS.OWNER_RESUME_CONFIRM,
					buildOwnerResumeConfirmationMenu(context, tournament)
				);
				await changeMenu(componentInteraction, nestedMenus, TOURNAMENT_MENU_IDS.OWNER_RESUME_CONFIRM);
			}
		})
	};
}

function buildOwnerResumeConfirmationMenu(context: TournamentMenuContext, tournament: TournamentMenuSummary): CrowniclesNestedMenu {
	const lng = getLanguage(context);
	const container = createContainer(
		i18n.t("commands:tournament.menu.resumeConfirmTitle", { lng }),
		i18n.t("commands:tournament.menu.resumeConfirmDescription", {
			lng,
			tournament: i18n.t("commands:tournament.menu.tournamentLabel", {
				lng,
				tournamentId: tournament.id
			}),
			channel: `<#${context.context.discord?.channel ?? ""}>`
		})
	);
	addCitySection({
		container,
		emote: CrowniclesIcons.collectors.accept,
		text: getTournamentSummaryDescription(tournament, lng),
		customId: TOURNAMENT_MENU_IDS.OWNER_RESUME_CONFIRM,
		buttonLabel: i18n.t("commands:tournament.menu.resumeConfirmButton", { lng }),
		buttonStyle: ReportCityButtonStyles.CONFIRM
	});
	addMenuNavigation(container, TOURNAMENT_MENU_IDS.OWNER_RESUME, lng);
	return {
		containers: [container],
		createCollector: createMenuCollector(context, async (componentInteraction, nestedMenus) => {
			if (!componentInteraction.isButton()) {
				return;
			}
			if (componentInteraction.customId === TOURNAMENT_MENU_IDS.OWNER_RESUME_CONFIRM) {
				await sendPacketFromMenu(
					componentInteraction,
					nestedMenus,
					context.context,
					makePacket(CommandTournamentResumePacketReq, { tournamentId: tournament.id })
				);
				return;
			}
			if (componentInteraction.customId === TOURNAMENT_MENU_IDS.BACK) {
				await changeMenu(componentInteraction, nestedMenus, TOURNAMENT_MENU_IDS.OWNER_RESUME);
				return;
			}
			if (componentInteraction.customId === TOURNAMENT_MENU_IDS.CLOSE) {
				await closeMenu(componentInteraction, nestedMenus);
			}
		})
	};
}

function parseMenuId(customId: string, prefix: string): number {
	return Number.parseInt(customId.slice(prefix.length), 10);
}

export async function handleTournamentAdminMenu(context: PacketContext, packet: CommandTournamentAdminMenuPacketRes): Promise<void> {
	const interaction = getInteraction(context);
	if (!interaction) {
		return;
	}
	const menuContext: TournamentMenuContext = {
		context,
		interaction,
		collectorTime: Constants.MESSAGES.COLLECTOR_TIME
	};
	const creationState: TournamentCreationMenuState = {
		levelLimitMode: TournamentLevelLimitModes.CATEGORY
	};
	const menus = new Map<string, CrowniclesNestedMenu>();
	menus.set(TOURNAMENT_MENU_IDS.ADMIN_CREATE, buildAdminCreateMenu(menuContext, creationState));
	menus.set(TOURNAMENT_MENU_IDS.ADMIN_CANCEL, buildAdminCancelMenu(menuContext, packet.tournaments));
	await sendMenu(menuContext, buildAdminRootMenu(menuContext, packet), menus);
}

export async function handleTournamentOwnerMenu(context: PacketContext, packet: CommandTournamentOwnerMenuPacketRes): Promise<void> {
	const interaction = getInteraction(context);
	if (!interaction) {
		return;
	}
	const menuContext: TournamentMenuContext = {
		context,
		interaction,
		collectorTime: Constants.MESSAGES.COLLECTOR_TIME
	};
	const menus = new Map<string, CrowniclesNestedMenu>();
	menus.set(TOURNAMENT_MENU_IDS.OWNER_RESUME, buildOwnerResumeMenu(menuContext, packet.pausedTournaments));
	await sendMenu(menuContext, buildOwnerRootMenu(menuContext, packet), menus);
}
