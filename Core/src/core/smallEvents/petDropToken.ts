/* @lockInherited — body runs under loadAndExecuteSmallEvents withLockedPlayerAndMissions callback. */
import { SmallEventFuncs } from "../../data/SmallEvent";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { SmallEventPetDropTokenPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventPetDropTokenPacket";
import { SmallEventDoNothingPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventDoNothingPacket";
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
		if (!Maps.isOnContinent(player) || player.tokens >= TokensConstants.MAX) {
			return false;
		}
		const link = MapLinkDataController.instance.getById(player.mapLinkId);
		if (!link) {
			return false;
		}
		const expeditions = await findPetsOnSamePath(link.startMap, link.endMap, player.id);
		return expeditions.length > 0;
	},
	executeSmallEvent: async (player, { response }): Promise<void> => {
		// canBeExecuted is skipped when the event is forced, and the expeditions may have ended since it was called
		const link = MapLinkDataController.instance.getById(player.mapLinkId);
		const expeditions = link ? await findPetsOnSamePath(link.startMap, link.endMap, player.id) : [];
		const expedition = expeditions.length > 0 ? RandomUtils.crowniclesRandom.pick(expeditions) : null;
		const petEntity = expedition ? await PetEntities.getById(expedition.petId) : null;
		if (!expedition || !petEntity) {
			response.push(makePacket(SmallEventDoNothingPacket, {}));
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
