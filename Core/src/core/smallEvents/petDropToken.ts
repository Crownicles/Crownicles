import { SmallEventFuncs } from "../../data/SmallEvent";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { SmallEventPetDropTokenPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventPetDropTokenPacket";
import { Maps } from "../maps/Maps";
import { PetExpedition } from "../database/game/models/PetExpedition";
import { PetEntities } from "../database/game/models/PetEntity";
import { Players } from "../database/game/models/Player";
import { MapLinkDataController } from "../../data/MapLink";
import { ExpeditionConstants } from "../../../../Lib/src/constants/ExpeditionConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { TokensConstants } from "../../../../Lib/src/constants/TokensConstants";
import { Op } from "sequelize";

/**
 * Find all pet expeditions that are in progress on the same map locations as the player's current path
 */
async function findPetsOnSamePath(startMapId: number, endMapId: number, playerId: number): Promise<PetExpedition[]> {
	return await PetExpedition.findAll({
		where: {
			mapLocationId: {
				[Op.in]: [startMapId, endMapId]
			},
			status: ExpeditionConstants.STATUS.IN_PROGRESS,
			playerId: { [Op.ne]: playerId }
		}
	});
}

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: async player => {
		if (!Maps.isOnContinent(player) || player.level < TokensConstants.LEVEL_TO_UNLOCK || player.tokens >= TokensConstants.MAX) {
			return false;
		}
		const link = MapLinkDataController.instance.getById(player.mapLinkId);
		if (!link) {
			return false;
		}
		const expeditions = await findPetsOnSamePath(link.startMap, link.endMap, player.id);
		return expeditions.length > 0;
	},
	executeSmallEvent: async (response, player): Promise<void> => {
		const link = MapLinkDataController.instance.getById(player.mapLinkId)!;

		const expeditions = await findPetsOnSamePath(link.startMap, link.endMap, player.id);
		if (expeditions.length === 0) {
			return;
		}

		const expedition = expeditions[RandomUtils.randInt(0, expeditions.length)];
		const petEntity = await PetEntities.getById(expedition.petId);
		if (!petEntity) {
			return;
		}

		const owner = await Players.getById(expedition.playerId);
		const petInfo = petEntity.getBasicInfo();

		await player.addTokens({
			amount: 1,
			response,
			reason: NumberChangeReason.SMALL_EVENT
		});
		await player.save();

		response.push(makePacket(SmallEventPetDropTokenPacket, {
			...petInfo,
			ownerKeycloakId: owner.keycloakId
		}));
	}
};
