import {
	ActionRowBuilder, ButtonBuilder, ContainerBuilder, TextDisplayBuilder
} from "discord.js";
import {
	CommandTournamentAdminMenuPacketRes, CommandTournamentCancelPacketReq,
	CommandTournamentCreatePacketReq
} from "../../../../Lib/src/packets/commands/CommandTournamentPacket";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	TournamentLevelLimitModes, type TournamentLevelLimitMode,
	type TournamentMenuSummary
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
import type { CrowniclesNestedMenu } from "../../messages/CrowniclesNestedMenus";

export type TournamentCreationMenuState = {
	registrationDays?: number;
	combatDays?: number;
	levelLimitMode: TournamentLevelLimitMode;
	levelCap?: number;
};

type DurationChoiceOptions = {
	container: ContainerBuilder;
	context: TournamentMenuContext;
	labelKey: string;
	selectedDays: number | undefined;
	customIdPrefix: string;
};

function getLanguage(context: TournamentMenuContext): TournamentMenuContext["interaction"]["userLanguage"] {
	return context.interaction.userLanguage;
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

function addDurationChoices(options: DurationChoiceOptions): void {
	const {
		container, context, labelKey, selectedDays, customIdPrefix
	} = options;
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

function addLevelModeChoices(container: ContainerBuilder, context: TournamentMenuContext, state: TournamentCreationMenuState): void {
	const lng = getLanguage(context);
	addSeparator(container);
	container.addTextDisplayComponents(new TextDisplayBuilder().setContent(i18n.t("commands:tournament.menu.levelMode", { lng })));
	const row = new ActionRowBuilder<ButtonBuilder>();
	for (const mode of Object.values(TournamentLevelLimitModes)) {
		row.addComponents(new ButtonBuilder()
			.setCustomId(`${TOURNAMENT_MENU_IDS.CREATE_LEVEL_MODE_PREFIX}${mode}`)
			.setLabel(getLevelModeLabel(mode, lng))
			.setStyle(mode === state.levelLimitMode ? ReportCityButtonStyles.CONFIRM : ReportCityButtonStyles.OPTION));
	}
	container.addActionRowComponents(row);
}

function addLevelCapChoices(container: ContainerBuilder, context: TournamentMenuContext, state: TournamentCreationMenuState): void {
	const lng = getLanguage(context);
	addSeparator(container);
	container.addTextDisplayComponents(new TextDisplayBuilder().setContent(i18n.t("commands:tournament.menu.levelCap", { lng })));
	const rows = [new ActionRowBuilder<ButtonBuilder>()];
	for (const levelCap of TOURNAMENT_LEVEL_CAP_OPTIONS) {
		addButtonToRow(rows, new ButtonBuilder()
			.setCustomId(`${TOURNAMENT_MENU_IDS.CREATE_LEVEL_CAP_PREFIX}${levelCap}`)
			.setLabel(levelCap.toString())
			.setStyle(levelCap === state.levelCap ? ReportCityButtonStyles.CONFIRM : ReportCityButtonStyles.OPTION));
	}
	container.addActionRowComponents(...rows);
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

function buildAdminCreateMenu(context: TournamentMenuContext, state: TournamentCreationMenuState): CrowniclesNestedMenu {
	const lng = getLanguage(context);
	const container = createContainer(
		i18n.t("commands:tournament.menu.createWizardTitle", { lng }),
		i18n.t("commands:tournament.menu.createWizardDescription", { lng })
	);
	addDurationChoices({
		container,
		context,
		labelKey: "commands:tournament.menu.registrationDuration",
		selectedDays: state.registrationDays,
		customIdPrefix: TOURNAMENT_MENU_IDS.CREATE_REGISTRATION_PREFIX
	});
	addDurationChoices({
		container,
		context,
		labelKey: "commands:tournament.menu.combatDuration",
		selectedDays: state.combatDays,
		customIdPrefix: TOURNAMENT_MENU_IDS.CREATE_COMBAT_PREFIX
	});
	addLevelModeChoices(container, context, state);
	if (isCustomLevelMode(state.levelLimitMode)) {
		addLevelCapChoices(container, context, state);
	}
	addSeparator(container);
	const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder()
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
		})
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
	const menus = new Map<string, CrowniclesNestedMenu>();
	menus.set(TOURNAMENT_MENU_IDS.ADMIN_CREATE, buildAdminCreateMenu(context, creationState));
	menus.set(TOURNAMENT_MENU_IDS.ADMIN_CANCEL, buildAdminCancelMenu(context, packet.tournaments));
	return {
		mainMenu: buildAdminRootMenu(context, packet),
		menus
	};
}
