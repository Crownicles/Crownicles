import Player from "../database/game/models/Player";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";
import { ClassInfoConstants } from "../../../../Lib/src/constants/ClassInfoConstants";
import {
	FightPetAction, FightPetActionDataController
} from "../../data/FightPetAction";
import { Maps } from "../maps/Maps";
import { SmallEventFuncs } from "../../data/SmallEvent";
import { PetDataController } from "../../data/Pet";
import { BlockingUtils } from "../utils/BlockingUtils";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import {
	EndCallback, ReactionCollectorInstance
} from "../utils/ReactionsCollector";
import {
	ReactionCollectorFightPet,
	ReactionCollectorFightPetReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorFightPet";
import { SmallEventFightPetPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventFightPetPacket";
import { PlayerActiveObjects } from "../database/game/models/PlayerActiveObjects";

/**
 * Returns an object composed of three random witch events
 * @param player all the information about the player
 */
function getRandomFightPetActions(player: Player): FightPetAction[] {
	let amountOfActions = SmallEventConstants.FIGHT_PET.BASE_ACTION_AMOUNT;

	// Higher level players get more actions
	if (player.level > SmallEventConstants.FIGHT_PET.LEVEL_TO_UNLOCK_NEW_ACTION) {
		amountOfActions++;
	}

	// Some classes get a bonus action
	if (player.class in ClassInfoConstants.CLASSES_WITH_BONUS_ACTION) {
		amountOfActions++;
	}

	// Get random actions
	const actions: FightPetAction[] = [];
	for (let i = 0; i < amountOfActions; ++i) {
		actions.push(FightPetActionDataController.instance.getRandomFightPetAction(actions));
	}

	return actions;
}

/**
 * Get the selected event from the user's choice
 * @param collector
 */
function retrieveSelectedEvent(collector: ReactionCollectorInstance): FightPetAction {
	const reaction = collector.getFirstReaction()?.reaction?.data as ReactionCollectorFightPetReaction;

	if (!reaction) {
		return FightPetActionDataController.instance.getNothing();
	}

	return FightPetActionDataController.instance.getById(reaction.actionId);
}

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: Maps.isOnPveIsland,
	executeSmallEvent: (response, player, context: PacketContext, playerActiveObjects: PlayerActiveObjects) => {
		const pet = PetDataController.instance.getRandom();
		const isFemale = RandomUtils.crowniclesRandom.bool();

		const collector = new ReactionCollectorFightPet(
			pet.id,
			isFemale,
			getRandomFightPetActions(player).map(fightAction => ({ actionId: fightAction.id }))
		);

		const endCallback: EndCallback = async (collector, response) => {
			const selectedFightPetAction = retrieveSelectedEvent(collector);
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.FIGHT_PET_CHOOSE);
			const outcomeIsSuccess = await selectedFightPetAction.applyOutcomeFightPetAction(player, pet, isFemale, playerActiveObjects);
			await player.addRage(outcomeIsSuccess ? 1 : 0, NumberChangeReason.FIGHT_PET_SMALL_EVENT, response);
			await player.save();
			response.push(makePacket(SmallEventFightPetPacket, {
				isSuccess: outcomeIsSuccess,
				fightPetActionId: selectedFightPetAction.id
			}));
		};

		const packet = new ReactionCollectorInstance(
			collector,
			context,
			{},
			endCallback
		)
			.block(player.keycloakId, BlockingConstants.REASONS.FIGHT_PET_CHOOSE)
			.build();

		response.push(packet);
	}
};
