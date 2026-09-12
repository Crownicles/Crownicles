import {
	ReactionCollectorPetTransferData, ReactionCollectorPetTransferDepositReaction, ReactionCollectorPetTransferWithdrawReaction, ReactionCollectorPetTransferSwitchReaction
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorPetTransfer";
import {
	ReactionCollectorPetFreeData, ReactionCollectorPetFreeShelterConfirmData, ReactionCollectorPetFreeSelectionData, ReactionCollectorPetFreeSelectReaction
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorPetFree";
import {
	PetFreeConfirmation, ShelterChoices
} from "../../../../../../WsPackets/src/objects/PetManagement";
import {
	PET_MANAGEMENT_DATA_KINDS, PET_MANAGEMENT_REACTION_KINDS
} from "../../../../../../WsPackets/src/fromServer/collectors";
import {
	DataMapping, defineDataMapping, defineReactionMapping, ReactionMapping
} from "../CollectorMapping";

function shelterChoices(data: ReactionCollectorPetTransferData): ShelterChoices {
	return {
		shelterPets: data.shelterPets, ...data.ownPet ? { ownPet: data.ownPet } : {}
	};
}
function freeConfirmation(data: ReactionCollectorPetFreeData, isFromShelter: boolean): PetFreeConfirmation {
	return {
		pet: {
			petTypeId: data.petId, petSex: data.petSex, ...data.petNickname ? { petNickname: data.petNickname } : {}
		},
		freeCost: data.freeCost,
		isFromShelter
	};
}
export const petManagementDataMappings: DataMapping[] = [
	defineDataMapping(ReactionCollectorPetTransferData, PET_MANAGEMENT_DATA_KINDS.TRANSFER, shelterChoices),
	defineDataMapping(ReactionCollectorPetFreeSelectionData, PET_MANAGEMENT_DATA_KINDS.FREE_SELECT, shelterChoices),
	defineDataMapping(ReactionCollectorPetFreeData, PET_MANAGEMENT_DATA_KINDS.FREE_CONFIRM, data => freeConfirmation(data, false)),
	defineDataMapping(ReactionCollectorPetFreeShelterConfirmData, PET_MANAGEMENT_DATA_KINDS.FREE_CONFIRM, data => freeConfirmation(data, data.isFromShelter))
];
export const petManagementReactionMappings: ReactionMapping[] = [
	defineReactionMapping(ReactionCollectorPetTransferDepositReaction, PET_MANAGEMENT_REACTION_KINDS.DEPOSIT, () => ({})),
	defineReactionMapping(ReactionCollectorPetTransferWithdrawReaction, PET_MANAGEMENT_REACTION_KINDS.WITHDRAW, data => ({ petEntityId: data.petEntityId })),
	defineReactionMapping(ReactionCollectorPetTransferSwitchReaction, PET_MANAGEMENT_REACTION_KINDS.SWITCH, data => ({ petEntityId: data.petEntityId })),
	defineReactionMapping(ReactionCollectorPetFreeSelectReaction, PET_MANAGEMENT_REACTION_KINDS.FREE_SELECT, data => ({ petEntityId: data.petEntityId }))
];
