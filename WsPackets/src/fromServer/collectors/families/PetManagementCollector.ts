import {
	PetFreeConfirmation, ShelterChoices
} from "../../../objects/PetManagement";
import {
	ReactionCollectorDataKind, ReactionCollectorReactionKind
} from "../ReactionCollectorProtocol";

declare module "../ReactionCollectorProtocol" {
	interface ReactionCollectorDataPayloads {
		petTransfer: ShelterChoices;
		petFreeSelect: ShelterChoices;
		petFreeConfirm: PetFreeConfirmation;
	}
	interface ReactionCollectorReactionPayloads {
		petDeposit: Record<string, never>;
		petWithdraw: { petEntityId: number };
		petSwitch: { petEntityId: number };
		petFreeSelect: { petEntityId: number };
	}
}
export const PET_MANAGEMENT_DATA_KINDS = {
	TRANSFER: "petTransfer", FREE_SELECT: "petFreeSelect", FREE_CONFIRM: "petFreeConfirm"
} as const satisfies Record<string, ReactionCollectorDataKind>;
export const PET_MANAGEMENT_REACTION_KINDS = {
	DEPOSIT: "petDeposit", WITHDRAW: "petWithdraw", SWITCH: "petSwitch", FREE_SELECT: "petFreeSelect"
} as const satisfies Record<string, ReactionCollectorReactionKind>;
