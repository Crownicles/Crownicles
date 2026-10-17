import { ContainerBuilder } from "discord.js";
import {
	CommandTournamentGenerateCodePacketReq, CommandTournamentOwnerMenuPacketRes, CommandTournamentResumePacketReq
} from "../../../../Lib/src/packets/commands/CommandTournamentPacket";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import type { TournamentMenuSummary } from "../../../../Lib/src/types/Tournament";
import { addCitySection } from "../player/report/ReportCityMenu";
import { ReportCityButtonStyles } from "../player/report/ReportCityMenuConstants";
import {
	addMenuNavigation, buildTournamentConfirmationMenu, buildTournamentSelectionMenu,
	changeMenu, closeMenu, createContainer, createMenuCollector, sendPacketFromMenu,
	TOURNAMENT_MENU_IDS, type TournamentMenuContext
} from "./TournamentMenuUtils";
import type { CrowniclesNestedMenu } from "../../messages/CrowniclesNestedMenus";
import i18n from "../../translations/i18n";

export function addResumeSection(
	container: ContainerBuilder,
	context: TournamentMenuContext,
	pausedTournaments: TournamentMenuSummary[]
): void {
	const lng = context.interaction.userLanguage;
	addCitySection({
		container,
		emote: CrowniclesIcons.notifications.types.tournament,
		title: i18n.t("commands:tournament.menu.resumeTitle", { lng }),
		description: pausedTournaments.length > 0
			? i18n.t("commands:tournament.menu.resumeDescription", { lng })
			: i18n.t("commands:tournament.menu.resumeUnavailable", { lng }),
		customId: TOURNAMENT_MENU_IDS.RESUME,
		buttonLabel: i18n.t("commands:tournament.menu.resumeButton", { lng }),
		buttonStyle: ReportCityButtonStyles.NAVIGATE,
		disabled: pausedTournaments.length === 0
	});
}

function buildOwnerRootMenu(
	context: TournamentMenuContext,
	packet: CommandTournamentOwnerMenuPacketRes
): CrowniclesNestedMenu {
	const lng = context.interaction.userLanguage;
	const container = createContainer(
		i18n.t("commands:tournament.menu.ownerTitle", { lng }),
		i18n.t("commands:tournament.menu.ownerDescription", { lng })
	);
	addCitySection({
		container,
		emote: CrowniclesIcons.collectors.accept,
		title: i18n.t("commands:tournament.menu.authorizeTitle", { lng }),
		description: i18n.t("commands:tournament.menu.authorizeDescription", { lng }),
		customId: TOURNAMENT_MENU_IDS.OWNER_AUTHORIZE,
		buttonLabel: i18n.t("commands:tournament.menu.authorizeButton", { lng }),
		buttonStyle: ReportCityButtonStyles.NAVIGATE
	});
	addResumeSection(container, context, packet.pausedTournaments);
	addMenuNavigation(container, undefined, lng);
	return {
		containers: [container],
		createCollector: createMenuCollector(context, async (componentInteraction, nestedMenus) => {
			if (!componentInteraction.isButton()) {
				return;
			}
			if (componentInteraction.customId === TOURNAMENT_MENU_IDS.OWNER_AUTHORIZE) {
				await sendPacketFromMenu(
					componentInteraction,
					nestedMenus,
					context.context,
					makePacket(CommandTournamentGenerateCodePacketReq, {})
				);
				return;
			}
			if (componentInteraction.customId === TOURNAMENT_MENU_IDS.RESUME) {
				await changeMenu(componentInteraction, nestedMenus, TOURNAMENT_MENU_IDS.RESUME);
				return;
			}
			if (componentInteraction.customId === TOURNAMENT_MENU_IDS.CLOSE) {
				await closeMenu(componentInteraction, nestedMenus);
			}
		})
	};
}

function buildResumeConfirmationMenu(
	context: TournamentMenuContext,
	tournament: TournamentMenuSummary
): CrowniclesNestedMenu {
	return buildTournamentConfirmationMenu({
		context,
		tournament,
		titleKey: "commands:tournament.menu.resumeConfirmTitle",
		descriptionKey: "commands:tournament.menu.resumeConfirmDescription",
		confirmCustomId: TOURNAMENT_MENU_IDS.RESUME_CONFIRM,
		confirmLabelKey: "commands:tournament.menu.resumeConfirmButton",
		confirmEmoji: CrowniclesIcons.collectors.accept,
		confirmStyle: ReportCityButtonStyles.CONFIRM,
		backMenuId: TOURNAMENT_MENU_IDS.RESUME,
		createPacket: tournamentId => makePacket(CommandTournamentResumePacketReq, { tournamentId })
	});
}

export function buildResumeMenu(
	context: TournamentMenuContext,
	pausedTournaments: TournamentMenuSummary[],
	rootMenuId: string
): CrowniclesNestedMenu {
	return buildTournamentSelectionMenu({
		context,
		tournaments: pausedTournaments,
		titleKey: "commands:tournament.menu.resumeListTitle",
		descriptionKey: "commands:tournament.menu.resumeListDescription",
		emptyDescriptionKey: "commands:tournament.menu.resumeUnavailable",
		selectPrefix: TOURNAMENT_MENU_IDS.RESUME_SELECT_PREFIX,
		backMenuId: rootMenuId,
		confirmationMenuId: TOURNAMENT_MENU_IDS.RESUME_CONFIRM,
		buildConfirmationMenu: tournament => buildResumeConfirmationMenu(context, tournament)
	});
}

export function buildOwnerMenus(
	context: TournamentMenuContext,
	packet: CommandTournamentOwnerMenuPacketRes
): {
	mainMenu: CrowniclesNestedMenu;
	menus: Map<string, CrowniclesNestedMenu>;
} {
	const mainMenu = buildOwnerRootMenu(context, packet);
	const menus = new Map<string, CrowniclesNestedMenu>();
	menus.set(TOURNAMENT_MENU_IDS.OWNER_ROOT, mainMenu);
	menus.set(TOURNAMENT_MENU_IDS.RESUME, buildResumeMenu(context, packet.pausedTournaments, TOURNAMENT_MENU_IDS.OWNER_ROOT));
	return {
		mainMenu,
		menus
	};
}
