import { MessageComponentInteraction } from "discord.js";
import {
	CrowniclesNestedMenuCollectorFactory, CrowniclesNestedMenus
} from "../../../messages/CrowniclesNestedMenus";
import { DiscordCollectorUtils } from "../../../utils/DiscordCollectorUtils";
import { CrowniclesLogger } from "../../../../../Lib/src/logs/CrowniclesLogger";
import { ReactionCollectorCreationPacket } from "../../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import {
	createCityCollector, handleStayInCityInteraction
} from "./ReportCityMenu";
import { ReportCityMenuIds } from "./ReportCityMenuConstants";
import { CityMenuParams } from "./ReportCityMenuTypes";

/**
 * Click on a button of a city sub-menu asking the Core to perform an action: the action acknowledges the click itself
 */
export type CityMenuAction = (componentInteraction: MessageComponentInteraction) => Promise<void>;

/**
 * Item selection buttons: their custom id is the prefix followed by the index of the item whose menu they open
 */
export type CityMenuItemSelection = {
	customIdPrefix: string;
	getMenuId: (itemIndex: number) => string;
};

/**
 * Buttons of a city sub-menu, besides the "stay in city" one that every sub-menu offers
 */
export type CityMenuButtons = {

	/** Menu opened by each navigation button, by custom id of the button */
	menuIds?: ReadonlyMap<string, string>;

	/** Custom id of the button going back to the city main menu */
	backToCityId?: string;

	itemSelection?: CityMenuItemSelection;

	/** Action of each action button, by custom id of the button */
	actions?: ReadonlyMap<string, CityMenuAction>;

	/** Leave unanswered a click on a button the menu does not offer (e.g. a stale button of the previous menu) instead of acknowledging it */
	ignoreOtherClicks?: boolean;
};

/**
 * Reaction of the city collector sent by an action button
 */
export type CityMenuReaction = {
	isMatching: (reaction: ReactionCollectorCreationPacket["reactions"][number]) => boolean;

	/** Error logged when the Core did not offer the reaction */
	notFoundError: string;
};

type CityMenuMove = (nestedMenus: CrowniclesNestedMenus, componentInteraction: MessageComponentInteraction) => Promise<void> | void;

function getSelectedItemMenuId(itemSelection: CityMenuItemSelection, customId: string): string | undefined {
	if (!customId.startsWith(itemSelection.customIdPrefix)) {
		return undefined;
	}
	const itemIndex = Number.parseInt(customId.slice(itemSelection.customIdPrefix.length), 10);
	return Number.isNaN(itemIndex) ? undefined : itemSelection.getMenuId(itemIndex);
}

/**
 * Where a click on a button of the menu leads, if the menu offers this button
 */
function findCityMenuMove(params: CityMenuParams, buttons: CityMenuButtons, customId: string): CityMenuMove | undefined {
	if (customId === ReportCityMenuIds.STAY_IN_CITY) {
		return (_nestedMenus, componentInteraction): void => handleStayInCityInteraction(params.packet, params.context, componentInteraction);
	}
	if (customId === buttons.backToCityId) {
		return (nestedMenus): Promise<void> => nestedMenus.changeToMainMenu();
	}
	const menuId = buttons.menuIds?.get(customId) ?? (buttons.itemSelection && getSelectedItemMenuId(buttons.itemSelection, customId));
	return menuId === undefined ? undefined : (nestedMenus): Promise<void> => nestedMenus.changeMenu(menuId);
}

/**
 * Build the collector of a city sub-menu from its buttons: the clicks of other users are refused, an action button
 * acknowledges its click itself and any other click is acknowledged by an update of the message before moving to the
 * menu it leads to
 */
export function createCityMenuCollector(params: CityMenuParams, buttons: CityMenuButtons): CrowniclesNestedMenuCollectorFactory {
	return createCityCollector(params.interaction, params.collectorTime, async (customId, componentInteraction, nestedMenus) => {
		const action = buttons.actions?.get(customId);
		if (action) {
			await action(componentInteraction);
			return;
		}
		const move = findCityMenuMove(params, buttons, customId);
		if (!move && buttons.ignoreOtherClicks) {
			return;
		}
		await DiscordCollectorUtils.deferUpdate(componentInteraction);
		await move?.(nestedMenus, componentInteraction);
	});
}

/**
 * Action sending a reaction of the city collector to the Core: the click is answered by a reply, deleted when the Core
 * did not offer the reaction
 */
export function createCityReactionAction(params: CityMenuParams, reaction: CityMenuReaction): CityMenuAction {
	return async (componentInteraction): Promise<void> => {
		await DiscordCollectorUtils.deferReply(componentInteraction);
		const reactionIndex = params.packet.reactions.findIndex(reaction.isMatching);
		if (reactionIndex === -1) {
			CrowniclesLogger.error(reaction.notFoundError);
			await componentInteraction.deleteReply();
			return;
		}
		DiscordCollectorUtils.sendReaction(params.packet, params.context, params.context.keycloakId!, componentInteraction, reactionIndex);
	};
}
