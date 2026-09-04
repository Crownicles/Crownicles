import {
	CommandTournamentAdminMenuPacketRes, CommandTournamentOwnerMenuPacketRes
} from "../../../../Lib/src/packets/commands/CommandTournamentPacket";
import {
	PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	createTournamentMenuContext, sendMenu
} from "./TournamentMenuUtils";
import { buildAdminMenus } from "./TournamentAdminMenus";
import { buildOwnerMenus } from "./TournamentOwnerMenus";

export { TOURNAMENT_MENU_IDS } from "./TournamentMenuUtils";

export async function handleTournamentAdminMenu(context: PacketContext, packet: CommandTournamentAdminMenuPacketRes): Promise<void> {
	const menuContext = createTournamentMenuContext(context);
	if (!menuContext) {
		return;
	}
	const menus = buildAdminMenus(menuContext, packet);
	await sendMenu(menuContext, menus.mainMenu, menus.menus);
}

export async function handleTournamentOwnerMenu(context: PacketContext, packet: CommandTournamentOwnerMenuPacketRes): Promise<void> {
	const menuContext = createTournamentMenuContext(context);
	if (!menuContext) {
		return;
	}
	const menus = buildOwnerMenus(menuContext, packet);
	await sendMenu(menuContext, menus.mainMenu, menus.menus);
}
