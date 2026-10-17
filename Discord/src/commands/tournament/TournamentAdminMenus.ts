import {
	ActionRowBuilder, ButtonBuilder, ContainerBuilder, MessageComponentInteraction,
	TextDisplayBuilder
} from "discord.js";
import {
	CommandTournamentAdminMenuPacketRes, CommandTournamentCancelPacketReq,
	CommandTournamentCreatePacketReq
} from "../../../../Lib/src/packets/commands/CommandTournamentPacket";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	TournamentLevelLimitModes, TournamentStatuses, type TournamentLevelLimitMode,
	type TournamentLevelSettings, type TournamentMenuSummary
} from "../../../../Lib/src/types/Tournament";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import { addButtonToRow } from "../../utils/DiscordCollectorUtils";
import i18n from "../../translations/i18n";
import { addCitySection } from "../player/report/ReportCityMenu";
import { ReportCityButtonStyles } from "../player/report/ReportCityMenuConstants";
import {
	addMenuNavigation, addSeparator, buildTournamentConfirmationMenu,
	buildTournamentSelectionMenu, changeMenu, closeMenu, createContainer,
	createMenuCollector, getDayLabel, parseMenuId,
	sendPacketFromMenu, TOURNAMENT_DURATION_OPTIONS, TOURNAMENT_LEVEL_CAP_OPTIONS,
	TOURNAMENT_MENU_IDS, type TournamentMenuContext
} from "./TournamentMenuUtils";
import type {
	CrowniclesNestedMenu, CrowniclesNestedMenus
} from "../../messages/CrowniclesNestedMenus";
import {
	addResumeSection, buildResumeMenu
} from "./TournamentOwnerMenus";
import {
	getTournamentLevelRuleDescription, getTournamentThresholdsSummary
} from "./TournamentDisplayUtils";

export type TournamentCreationMenuState = {
	registrationDays?: number;
	combatDays?: number;
	levelLimitMode: TournamentLevelLimitMode;
	levelCap?: number;
};

type ButtonChoiceSectionOptions = {
	container: ContainerBuilder;
	context: TournamentMenuContext;
	labelKey: string;
	choices: ButtonChoice[];
};

type ButtonChoice = {
	customId: string;
	label: string;
	style: typeof ReportCityButtonStyles[keyof typeof ReportCityButtonStyles];
};

type DurationChoiceOptions = {
	prefix: string;
	selectedDays?: number;
	lng: TournamentMenuContext["interaction"]["userLanguage"];
};

function getLanguage(context: TournamentMenuContext): TournamentMenuContext["interaction"]["userLanguage"] {
	return context.interaction.userLanguage;
}

const ADMIN_ROOT_NAVIGATION_IDS = [
	TOURNAMENT_MENU_IDS.ADMIN_CREATE,
	TOURNAMENT_MENU_IDS.ADMIN_CANCEL,
	TOURNAMENT_MENU_IDS.RESUME
] as const;

function getPausedTournaments(packet: CommandTournamentAdminMenuPacketRes): TournamentMenuSummary[] {
	return packet.tournaments.filter(tournament => tournament.status === TournamentStatuses.PAUSED);
}

function buildAdminCancelConfirmationMenu(
	context: TournamentMenuContext,
	tournament: TournamentMenuSummary
): CrowniclesNestedMenu {
	return buildTournamentConfirmationMenu({
		context,
		tournament,
		titleKey: "commands:tournament.menu.cancelConfirmTitle",
		descriptionKey: "commands:tournament.menu.cancelConfirmDescription",
		confirmCustomId: TOURNAMENT_MENU_IDS.ADMIN_CANCEL_CONFIRM,
		confirmLabelKey: "commands:tournament.menu.cancelConfirmButton",
		confirmEmoji: CrowniclesIcons.collectors.refuse,
		confirmStyle: ReportCityButtonStyles.DESTRUCTIVE,
		backMenuId: TOURNAMENT_MENU_IDS.ADMIN_CANCEL,
		createPacket: tournamentId => makePacket(CommandTournamentCancelPacketReq, { tournamentId })
	});
}

function buildAdminCancelMenu(
	context: TournamentMenuContext,
	tournaments: TournamentMenuSummary[]
): CrowniclesNestedMenu {
	return buildTournamentSelectionMenu({
		context,
		tournaments,
		titleKey: "commands:tournament.menu.cancelListTitle",
		descriptionKey: "commands:tournament.menu.cancelListDescription",
		emptyDescriptionKey: "commands:tournament.menu.cancelUnavailable",
		selectPrefix: TOURNAMENT_MENU_IDS.ADMIN_CANCEL_SELECT_PREFIX,
		backMenuId: TOURNAMENT_MENU_IDS.ADMIN_ROOT,
		confirmationMenuId: TOURNAMENT_MENU_IDS.ADMIN_CANCEL_CONFIRM,
		buildConfirmationMenu: tournament => buildAdminCancelConfirmationMenu(context, tournament)
	});
}

function buildAdminRootMenu(
	context: TournamentMenuContext,
	packet: CommandTournamentAdminMenuPacketRes
): CrowniclesNestedMenu {
	const lng = getLanguage(context);
	const container = createContainer(
		i18n.t("commands:tournament.menu.adminTitle", { lng }),
		i18n.t("commands:tournament.menu.adminDescription", {
			lng,
			count: packet.tournaments.length
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
	addResumeSection(container, context, getPausedTournaments(packet));
	addMenuNavigation(container, undefined, lng);
	return {
		containers: [container],
		createCollector: createMenuCollector(context, async (componentInteraction, nestedMenus) => {
			if (!componentInteraction.isButton()) {
				return;
			}
			const targetMenuId = ADMIN_ROOT_NAVIGATION_IDS.find(menuId => menuId === componentInteraction.customId);
			if (targetMenuId) {
				await changeMenu(componentInteraction, nestedMenus, targetMenuId);
				return;
			}
			if (componentInteraction.customId === TOURNAMENT_MENU_IDS.CLOSE) {
				await closeMenu(componentInteraction, nestedMenus);
			}
		})
	};
}

function addButtonChoiceSection(options: ButtonChoiceSectionOptions): void {
	const {
		container, context, labelKey, choices
	} = options;
	const lng = getLanguage(context);
	addSeparator(container);
	container.addTextDisplayComponents(new TextDisplayBuilder().setContent(i18n.t(labelKey, { lng })));
	const rows = [new ActionRowBuilder<ButtonBuilder>()];
	for (const choice of choices) {
		addButtonToRow(rows, new ButtonBuilder()
			.setCustomId(choice.customId)
			.setLabel(choice.label)
			.setStyle(choice.style));
	}
	container.addActionRowComponents(...rows);
}

function buildDurationChoices(options: DurationChoiceOptions): ButtonChoice[] {
	const {
		prefix, selectedDays, lng
	} = options;
	return TOURNAMENT_DURATION_OPTIONS.map(days => ({
		customId: `${prefix}${days}`,
		label: getDayLabel(days, lng),
		style: days === selectedDays ? ReportCityButtonStyles.CONFIRM : ReportCityButtonStyles.OPTION
	}));
}

function getLevelModeLabel(mode: TournamentLevelLimitMode, lng: TournamentMenuContext["interaction"]["userLanguage"]): string {
	return i18n.t(`commands:tournament.menu.levelMode${mode.charAt(0).toUpperCase()}${mode.slice(1)}`, { lng });
}

function isCustomLevelMode(mode: TournamentLevelLimitMode): boolean {
	return mode === TournamentLevelLimitModes.CAP || mode === TournamentLevelLimitModes.REJECT;
}

function isCreationComplete(state: TournamentCreationMenuState): boolean {
	return state.registrationDays !== undefined
		&& state.combatDays !== undefined
		&& (!isCustomLevelMode(state.levelLimitMode) || state.levelCap !== undefined);
}

type CompleteTournamentCreationMenuState = TournamentCreationMenuState & {
	registrationDays: number;
	combatDays: number;
};

function isCompleteTournamentCreationMenuState(state: TournamentCreationMenuState): state is CompleteTournamentCreationMenuState {
	return isCreationComplete(state);
}

function buildLevelModeChoices(context: TournamentMenuContext, state: TournamentCreationMenuState): ButtonChoice[] {
	const lng = getLanguage(context);
	return Object.values(TournamentLevelLimitModes).map(mode => ({
		customId: `${TOURNAMENT_MENU_IDS.CREATE_LEVEL_MODE_PREFIX}${mode}`,
		label: getLevelModeLabel(mode, lng),
		style: mode === state.levelLimitMode ? ReportCityButtonStyles.CONFIRM : ReportCityButtonStyles.OPTION
	}));
}

function buildLevelCapChoices(state: TournamentCreationMenuState): ButtonChoice[] {
	return TOURNAMENT_LEVEL_CAP_OPTIONS.map(levelCap => ({
		customId: `${TOURNAMENT_MENU_IDS.CREATE_LEVEL_CAP_PREFIX}${levelCap}`,
		label: levelCap.toString(),
		style: levelCap === state.levelCap ? ReportCityButtonStyles.CONFIRM : ReportCityButtonStyles.OPTION
	}));
}

function buildCreationPacket(state: TournamentCreationMenuState): CrowniclesPacket | null {
	if (!isCompleteTournamentCreationMenuState(state)) {
		return null;
	}
	return makePacket(CommandTournamentCreatePacketReq, {
		registrationDays: state.registrationDays,
		combatDays: state.combatDays,
		levelLimitMode: state.levelLimitMode,
		...state.levelCap !== undefined ? { levelCap: state.levelCap } : {}
	});
}

function applyCreationSelection(customId: string, state: TournamentCreationMenuState): boolean {
	const numericSelections: {
		prefix: string;
		stateKey: "registrationDays" | "combatDays" | "levelCap";
	}[] = [
		{
			prefix: TOURNAMENT_MENU_IDS.CREATE_REGISTRATION_PREFIX,
			stateKey: "registrationDays"
		},
		{
			prefix: TOURNAMENT_MENU_IDS.CREATE_COMBAT_PREFIX,
			stateKey: "combatDays"
		},
		{
			prefix: TOURNAMENT_MENU_IDS.CREATE_LEVEL_CAP_PREFIX,
			stateKey: "levelCap"
		}
	];
	const numericSelection = numericSelections.find(selection => customId.startsWith(selection.prefix));
	if (numericSelection) {
		state[numericSelection.stateKey] = parseMenuId(customId, numericSelection.prefix);
		return true;
	}
	if (!customId.startsWith(TOURNAMENT_MENU_IDS.CREATE_LEVEL_MODE_PREFIX)) {
		return false;
	}
	state.levelLimitMode = customId.slice(TOURNAMENT_MENU_IDS.CREATE_LEVEL_MODE_PREFIX.length) as TournamentLevelLimitMode;
	if (!isCustomLevelMode(state.levelLimitMode)) {
		state.levelCap = undefined;
	}
	return true;
}

function getCreationLevelSettings(state: TournamentCreationMenuState): TournamentLevelSettings {
	return {
		levelLimitMode: state.levelLimitMode,
		levelCap: state.levelCap ?? null
	};
}

function getSelectedLevelRuleDescription(state: TournamentCreationMenuState, lng: TournamentMenuContext["interaction"]["userLanguage"]): string {
	if (isCustomLevelMode(state.levelLimitMode) && state.levelCap === undefined) {
		return i18n.t("commands:tournament.menu.levelCapMissing", { lng });
	}
	return i18n.t("commands:tournament.menu.levelModeSelected", {
		lng,
		levelRule: getTournamentLevelRuleDescription(getCreationLevelSettings(state), lng)
	});
}

function getMissingCreationChoiceDescription(state: TournamentCreationMenuState, lng: TournamentMenuContext["interaction"]["userLanguage"]): string | null {
	if (state.registrationDays === undefined || state.combatDays === undefined) {
		return i18n.t("commands:tournament.menu.createMissingDurations", { lng });
	}
	if (!isCreationComplete(state)) {
		return i18n.t("commands:tournament.menu.createMissingLevelCap", { lng });
	}
	return null;
}

function buildAdminCreateContainer(context: TournamentMenuContext, state: TournamentCreationMenuState): ContainerBuilder {
	const lng = getLanguage(context);
	const container = createContainer(
		i18n.t("commands:tournament.menu.createWizardTitle", { lng }),
		i18n.t("commands:tournament.menu.createWizardDescription", {
			lng,
			channel: `<#${context.interaction.channelId}>`,
			thresholds: getTournamentThresholdsSummary(getCreationLevelSettings(state), lng)
		})
	);
	addButtonChoiceSection({
		container,
		context,
		labelKey: "commands:tournament.menu.registrationDuration",
		choices: buildDurationChoices({
			prefix: TOURNAMENT_MENU_IDS.CREATE_REGISTRATION_PREFIX,
			selectedDays: state.registrationDays,
			lng
		})
	});
	addButtonChoiceSection({
		container,
		context,
		labelKey: "commands:tournament.menu.combatDuration",
		choices: buildDurationChoices({
			prefix: TOURNAMENT_MENU_IDS.CREATE_COMBAT_PREFIX,
			selectedDays: state.combatDays,
			lng
		})
	});
	addButtonChoiceSection({
		container,
		context,
		labelKey: "commands:tournament.menu.levelMode",
		choices: buildLevelModeChoices(context, state)
	});
	if (isCustomLevelMode(state.levelLimitMode)) {
		addButtonChoiceSection({
			container,
			context,
			labelKey: "commands:tournament.menu.levelCap",
			choices: buildLevelCapChoices(state)
		});
	}
	container.addTextDisplayComponents(new TextDisplayBuilder().setContent(getSelectedLevelRuleDescription(state, lng)));
	addSeparator(container);
	const missingChoice = getMissingCreationChoiceDescription(state, lng);
	if (missingChoice) {
		container.addTextDisplayComponents(new TextDisplayBuilder().setContent(missingChoice));
	}
	const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder()
		.setCustomId(TOURNAMENT_MENU_IDS.CREATE_CONFIRM)
		.setLabel(i18n.t("commands:tournament.menu.createConfirmButton", { lng }))
		.setEmoji(CrowniclesIcons.collectors.accept)
		.setStyle(ReportCityButtonStyles.CONFIRM)
		.setDisabled(!isCreationComplete(state)));
	container.addActionRowComponents(actionRow);
	addMenuNavigation(container, TOURNAMENT_MENU_IDS.ADMIN_ROOT, lng);
	return container;
}

async function handleAdminCreateInteraction(
	context: TournamentMenuContext,
	state: TournamentCreationMenuState,
	componentInteraction: MessageComponentInteraction,
	nestedMenus: CrowniclesNestedMenus
): Promise<void> {
	if (!componentInteraction.isButton()) {
		return;
	}
	if (applyCreationSelection(componentInteraction.customId, state)) {
		nestedMenus.registerMenu(TOURNAMENT_MENU_IDS.ADMIN_CREATE, buildAdminCreateMenu(context, state));
		await changeMenu(componentInteraction, nestedMenus, TOURNAMENT_MENU_IDS.ADMIN_CREATE);
		return;
	}
	if (componentInteraction.customId === TOURNAMENT_MENU_IDS.CREATE_CONFIRM) {
		const packet = buildCreationPacket(state);
		if (packet) {
			await sendPacketFromMenu(componentInteraction, nestedMenus, context.context, packet);
		}
		return;
	}
	if (componentInteraction.customId === TOURNAMENT_MENU_IDS.BACK) {
		await changeMenu(componentInteraction, nestedMenus, TOURNAMENT_MENU_IDS.ADMIN_ROOT);
		return;
	}
	if (componentInteraction.customId === TOURNAMENT_MENU_IDS.CLOSE) {
		await closeMenu(componentInteraction, nestedMenus);
	}
}

function buildAdminCreateMenu(context: TournamentMenuContext, state: TournamentCreationMenuState): CrowniclesNestedMenu {
	return {
		containers: [buildAdminCreateContainer(context, state)],
		createCollector: createMenuCollector(context, handleAdminCreateInteraction.bind(undefined, context, state))
	};
}

export function buildAdminMenus(
	context: TournamentMenuContext,
	packet: CommandTournamentAdminMenuPacketRes
): {
	mainMenu: CrowniclesNestedMenu;
	menus: Map<string, CrowniclesNestedMenu>;
} {
	const creationState: TournamentCreationMenuState = {
		levelLimitMode: TournamentLevelLimitModes.CATEGORY
	};
	const mainMenu = buildAdminRootMenu(context, packet);
	const menus = new Map<string, CrowniclesNestedMenu>();
	menus.set(TOURNAMENT_MENU_IDS.ADMIN_ROOT, mainMenu);
	menus.set(TOURNAMENT_MENU_IDS.ADMIN_CREATE, buildAdminCreateMenu(context, creationState));
	menus.set(TOURNAMENT_MENU_IDS.ADMIN_CANCEL, buildAdminCancelMenu(context, packet.tournaments));
	menus.set(TOURNAMENT_MENU_IDS.RESUME, buildResumeMenu(context, getPausedTournaments(packet), TOURNAMENT_MENU_IDS.ADMIN_ROOT));
	return {
		mainMenu,
		menus
	};
}
