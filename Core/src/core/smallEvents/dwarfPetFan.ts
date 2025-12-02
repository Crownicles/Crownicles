import { SmallEventFuncs } from "../../data/SmallEvent";
import { Maps } from "../maps/Maps";
import Player from "../database/game/models/Player";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { SmallEventDwarfPetFanPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventDwarfPetFanPacket";
import {
	PetEntities, PetEntity
} from "../database/game/models/PetEntity";
import { DwarfPetsSeen } from "../database/game/models/DwarfPetsSeen";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { PlayerMissionsInfos } from "../database/game/models/PlayerMissionsInfo";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { SexTypeShort } from "../../../../Lib/src/constants/StringConstants";
import { MapConstants } from "../../../../Lib/src/constants/MapConstants";
import { Badge } from "../../../../Lib/src/types/Badge";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";
import { MissionsController } from "../missions/MissionsController";
import { PetConstants } from "../../../../Lib/src/constants/PetConstants";
import { PetUtils } from "../utils/PetUtils";

/**
 * Return true if the player has a pet AND the pet is not feisty AND the dwarf never saw this pet from it
 * @param response
 * @param player
 * @param petEntity
 */
async function canContinueSmallEvent(response: CrowniclesPacket[], player: Player, petEntity: PetEntity): Promise<boolean> {
	// Check if the player has shown all the pets
	if (await DwarfPetsSeen.isAllPetSeen(player)) {
		await manageAllPetsAreSeen(response, player, petEntity);
		return false;
	}

	// Check if the player has a pet
	if (!player.petId) {
		response.push(makePacket(SmallEventDwarfPetFanPacket, { interactionName: SmallEventConstants.DWARF_PET_FAN.INTERACTIONS_NAMES.NO_PET }));
		return false;
	}

	// Check if the pet is available (not on expedition without clone talisman)
	if (!await PetUtils.isPetAvailable(player, PetConstants.AVAILABILITY_CONTEXT.SMALL_EVENT)) {
		response.push(makePacket(SmallEventDwarfPetFanPacket, { interactionName: SmallEventConstants.DWARF_PET_FAN.INTERACTIONS_NAMES.NO_PET }));
		return false;
	}

	if (petEntity.isFeisty()) {
		response.push(makePacket(SmallEventDwarfPetFanPacket, {
			interactionName: SmallEventConstants.DWARF_PET_FAN.INTERACTIONS_NAMES.FEISTY_PET,
			petNickname: petEntity.nickname,
			petSex: petEntity.sex as SexTypeShort,
			petTypeId: petEntity.typeId
		}));
		return false;
	}

	// Check if the dwarf has already seen this pet
	if (await DwarfPetsSeen.isPetSeen(player, petEntity.typeId)) {
		response.push(makePacket(SmallEventDwarfPetFanPacket, {
			interactionName: SmallEventConstants.DWARF_PET_FAN.INTERACTIONS_NAMES.PET_ALREADY_SEEN,
			petNickname: petEntity.nickname,
			petSex: petEntity.sex as SexTypeShort,
			petTypeId: petEntity.typeId
		}));
		return false;
	}
	return true;
}

/**
 * Manage when the player has shown all the pets to the dwarf
 * @param response
 * @param player
 * @param petEntity
 */
async function manageAllPetsAreSeen(response: CrowniclesPacket[], player: Player, petEntity: PetEntity): Promise<void> {
	if (player.petId && petEntity.isFeisty()) {
		response.push(makePacket(SmallEventDwarfPetFanPacket, {
			petNickname: petEntity.nickname,
			petSex: petEntity.sex as SexTypeShort,
			petTypeId: petEntity.typeId,
			interactionName: SmallEventConstants.DWARF_PET_FAN.INTERACTIONS_NAMES.FEISTY_PET
		}));
		return;
	}

	if (!player.hasBadge(Badge.ANIMAL_LOVER)) {
		player.addBadge(Badge.ANIMAL_LOVER);
		response.push(makePacket(SmallEventDwarfPetFanPacket, {
			interactionName: SmallEventConstants.DWARF_PET_FAN.INTERACTIONS_NAMES.BADGE
		}));
		await player.save();
		return;
	}

	// Give a gem
	if (RandomUtils.crowniclesRandom.bool(SmallEventConstants.DWARF_PET_FAN.ALL_PETS_SEEN.GEM_PROBABILITY)) {
		const missionInfo = await PlayerMissionsInfos.getOfPlayer(player.id);
		await missionInfo.addGems(
			SmallEventConstants.DWARF_PET_FAN.ALL_PETS_SEEN.GEM_REWARD,
			player.keycloakId,
			NumberChangeReason.SMALL_EVENT
		);
		await missionInfo.save();
		response.push(makePacket(SmallEventDwarfPetFanPacket, {
			interactionName: SmallEventConstants.DWARF_PET_FAN.INTERACTIONS_NAMES.ALL_PETS_SEEN,
			isGemReward: true,
			amount: SmallEventConstants.DWARF_PET_FAN.ALL_PETS_SEEN.GEM_REWARD
		}));
		return;
	}

	// Give money
	await player.addMoney({
		amount: SmallEventConstants.DWARF_PET_FAN.ALL_PETS_SEEN.MONEY_REWARD,
		response,
		reason: NumberChangeReason.SMALL_EVENT
	});
	await player.save();
	response.push(makePacket(SmallEventDwarfPetFanPacket, {
		interactionName: SmallEventConstants.DWARF_PET_FAN.INTERACTIONS_NAMES.ALL_PETS_SEEN,
		amount: SmallEventConstants.DWARF_PET_FAN.ALL_PETS_SEEN.MONEY_REWARD
	}));
}

/**
 * Manage when the player shows a new pet to the dwarf
 * @param response
 * @param player
 * @param petEntity
 */
async function manageNewPetSeen(response: CrowniclesPacket[], player: Player, petEntity: PetEntity): Promise<void> {
	const isPetClone = await PetUtils.isPetClone(player);

	// If pet is a clone, Talvar notices something strange but still gives reward
	if (isPetClone) {
		const missionInfo = await PlayerMissionsInfos.getOfPlayer(player.id);
		await missionInfo.addGems(
			SmallEventConstants.DWARF_PET_FAN.NEW_PET_SEEN_REWARD,
			player.keycloakId,
			NumberChangeReason.SMALL_EVENT
		);
		response.push(makePacket(SmallEventDwarfPetFanPacket, {
			interactionName: SmallEventConstants.DWARF_PET_FAN.INTERACTIONS_NAMES.CLONE_PET,
			amount: SmallEventConstants.DWARF_PET_FAN.NEW_PET_SEEN_REWARD,
			petNickname: petEntity.nickname,
			petSex: petEntity.sex as SexTypeShort,
			petTypeId: petEntity.typeId,
			isGemReward: true,
			isPetClone: true
		}));

		// Still mark the pet as seen
		await DwarfPetsSeen.markPetAsSeen(player, petEntity.typeId);
		await MissionsController.update(player, response, { missionId: "showPetsToTalvar" });
		return;
	}

	await DwarfPetsSeen.markPetAsSeen(player, petEntity.typeId);
	const missionInfo = await PlayerMissionsInfos.getOfPlayer(player.id);
	await missionInfo.addGems(
		SmallEventConstants.DWARF_PET_FAN.NEW_PET_SEEN_REWARD,
		player.keycloakId,
		NumberChangeReason.SMALL_EVENT
	);
	response.push(makePacket(SmallEventDwarfPetFanPacket, {
		interactionName: SmallEventConstants.DWARF_PET_FAN.INTERACTIONS_NAMES.NEW_PET_SEEN,
		amount: SmallEventConstants.DWARF_PET_FAN.NEW_PET_SEEN_REWARD,
		petNickname: petEntity.nickname,
		petSex: petEntity.sex as SexTypeShort,
		petTypeId: petEntity.typeId,
		isGemReward: true
	}));
	await MissionsController.update(player, response, { missionId: "showPetsToTalvar" });
}

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: player => {
		const destination = player.getDestination();
		const origin = player.getPreviousMap();
		return Maps.isOnContinent(player)
			&& [destination.id, origin.id].some(mapId =>
				[MapConstants.LOCATIONS_IDS.MOUNT_CELESTRUM].includes(mapId));
	},
	executeSmallEvent: async (response, player, _context): Promise<void> => {
		await MissionsController.update(player, response, { missionId: "meetTalvar" });

		const petEntity = await PetEntities.getById(player.petId);
		if (!await canContinueSmallEvent(response, player, petEntity)) {
			return;
		}

		await manageNewPetSeen(response, player, petEntity);
	}
};
