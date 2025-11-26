import { SmallEventFuncs } from "../../data/SmallEvent";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import Player from "../database/game/models/Player";
import { PetEntities } from "../database/game/models/PetEntity";
import { PetExpeditions } from "../database/game/models/PetExpedition";
import { ExpeditionConstants } from "../../../../Lib/src/constants/ExpeditionConstants";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { SmallEventExpeditionAdvicePacket } from "../../../../Lib/src/packets/smallEvents/SmallEventExpeditionAdvicePacket";
import { SexTypeShort } from "../../../../Lib/src/constants/StringConstants";
import { Maps } from "../maps/Maps";

/**
 * Check if the small event can be executed for this player
 * Requires: player level >= 20 and on continent
 */
function canBeExecuted(player: Player): boolean {
	// Must be on continent
	if (!Maps.isOnContinent(player)) {
		return false;
	}

	// Must be level 20 or higher
	if (player.level < ExpeditionConstants.TALISMAN_EVENT.MIN_LEVEL) {
		return false;
	}

	return true;
}

/**
 * Execute the expedition advice small event
 * - If player doesn't have talisman: give it and explain expeditions
 * - If player has talisman and pet in expedition: give bonus rewards
 * - If player has talisman but no pet in expedition: just give advice
 */
async function executeSmallEvent(
	response: CrowniclesPacket[],
	player: Player,
	_context: PacketContext,
	_testArgs?: string[]
): Promise<void> {
	const alreadyHasTalisman = player.hasTalisman;
	let talismanGiven = false;
	let petInExpedition = false;
	let bonusMoney: number | undefined;
	let bonusExperience: number | undefined;
	let petTypeId: number | undefined;
	let petSex: SexTypeShort | undefined;
	let petNickname: string | undefined;
	let interactionType: string;

	// Check if player has a pet in expedition
	const activeExpedition = await PetExpeditions.getActiveExpeditionForPlayer(player.id);
	if (activeExpedition && player.petId) {
		petInExpedition = true;
		const petEntity = await PetEntities.getById(player.petId);
		if (petEntity) {
			petTypeId = petEntity.typeId;
			petSex = petEntity.sex as SexTypeShort;
			petNickname = petEntity.nickname ?? undefined;
		}
	}

	if (!alreadyHasTalisman) {
		// Give the talisman
		player.hasTalisman = true;
		talismanGiven = true;
		await player.save();
		interactionType = "talismanReceived";
	}
	else if (petInExpedition) {
		// Bonus rewards for having pet in expedition
		bonusMoney = RandomUtils.randInt(
			ExpeditionConstants.TALISMAN_EVENT.BONUS_IF_PET_IN_EXPEDITION.MONEY_MIN,
			ExpeditionConstants.TALISMAN_EVENT.BONUS_IF_PET_IN_EXPEDITION.MONEY_MAX + 1
		);
		bonusExperience = RandomUtils.randInt(
			ExpeditionConstants.TALISMAN_EVENT.BONUS_IF_PET_IN_EXPEDITION.EXPERIENCE_MIN,
			ExpeditionConstants.TALISMAN_EVENT.BONUS_IF_PET_IN_EXPEDITION.EXPERIENCE_MAX + 1
		);

		await player.addMoney({
			amount: bonusMoney,
			response,
			reason: NumberChangeReason.SMALL_EVENT
		});
		await player.addExperience({
			amount: bonusExperience,
			response,
			reason: NumberChangeReason.SMALL_EVENT
		});
		await player.save();
		interactionType = "expeditionBonus";
	}
	else {
		// Just give advice
		interactionType = "advice";
	}

	response.push(makePacket(SmallEventExpeditionAdvicePacket, {
		alreadyHasTalisman,
		talismanGiven,
		petInExpedition,
		bonusMoney,
		bonusExperience,
		petTypeId,
		petSex,
		petNickname,
		interactionType
	}));
}

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted,
	executeSmallEvent
};
