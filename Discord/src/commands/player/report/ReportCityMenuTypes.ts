import { MessageComponentInteraction } from "discord.js";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { ReactionCollectorCityData } from "../../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { ReactionCollectorCreationPacket } from "../../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { CrowniclesNestedMenus } from "../../../messages/CrowniclesNestedMenus";
import { CrowniclesInteraction } from "../../../messages/CrowniclesInteraction";

/**
 * Manage-home payload shared between the city main menu and the notary sub-menu.
 */
export type ManageHomeData = NonNullable<ReactionCollectorCityData["home"]["manage"]>;

/**
 * Common parameters for building a city sub-menu (main, inn, enchanter, notary, ...).
 */
export type CityMenuParams = {
	context: PacketContext;
	interaction: CrowniclesInteraction;
	packet: ReactionCollectorCreationPacket;
	collectorTime: number;
	pseudo: string;
};

/**
 * Common parameters for handling a click inside a city sub-menu collector.
 */
export type CityCollectorHandlerParams = {
	selectedValue: string;
	buttonInteraction: MessageComponentInteraction;
	nestedMenus: CrowniclesNestedMenus;
	context: PacketContext;
	packet: ReactionCollectorCreationPacket;
};
