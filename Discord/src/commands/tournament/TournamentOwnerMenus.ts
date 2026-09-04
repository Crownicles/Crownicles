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

function buildOwnerResumeConfirmationMenu(
	context: TournamentMenuContext,
	tournament: TournamentMenuSummary
): CrowniclesNestedMenu {
	return buildTournamentConfirmationMenu({
		context,
		tournament,
		titleKey: "commands:tournament.menu.resumeConfirmTitle",
		descriptionKey: "commands:tournament.menu.resumeConfirmDescription",
		confirmCustomId: TOURNAMENT_MENU_IDS.OWNER_RESUME_CONFIRM,
		confirmLabelKey: "commands:tournament.menu.resumeConfirmButton",
		confirmEmoji: CrowniclesIcons.collectors.accept,
		confirmStyle: ReportCityButtonStyles.CONFIRM,
		backMenuId: TOURNAMENT_MENU_IDS.OWNER_RESUME,
		createPacket: tournamentId => makePacket(CommandTournamentResumePacketReq, { tournamentId })
	});
}

function buildOwnerResumeMenu(
	context: TournamentMenuContext,
	tournaments: CommandTournamentOwnerMenuPacketRes["pausedTournaments"]
): CrowniclesNestedMenu {
	return buildTournamentSelectionMenu({
		context,
		tournaments,
		titleKey: "commands:tournament.menu.resumeListTitle",
		descriptionKey: "commands:tournament.menu.resumeListDescription",
		emptyDescriptionKey: "commands:tournament.menu.resumeUnavailable",
		selectPrefix: TOURNAMENT_MENU_IDS.OWNER_RESUME_SELECT_PREFIX,
		backMenuId: TOURNAMENT_MENU_IDS.OWNER_ROOT,
		confirmationMenuId: TOURNAMENT_MENU_IDS.OWNER_RESUME_CONFIRM,
		buildConfirmationMenu: tournament => buildOwnerResumeConfirmationMenu(context, tournament)
	});
}

export function buildOwnerMenus(
	context: TournamentMenuContext,
	packet: CommandTournamentOwnerMenuPacketRes
): {
	mainMenu: CrowniclesNestedMenu;
	menus: Map<string, CrowniclesNestedMenu>;
} {
	const menus = new Map<string, CrowniclesNestedMenu>();
	menus.set(TOURNAMENT_MENU_IDS.OWNER_RESUME, buildOwnerResumeMenu(context, packet.pausedTournaments));
	return {
		mainMenu: buildOwnerRootMenu(context, packet),
		menus
	};
}
