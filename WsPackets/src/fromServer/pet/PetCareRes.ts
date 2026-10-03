import { FromServerPacket } from "../FromServerPacket";
import { OwnedPet } from "../../objects/OwnedPet";
import {
	PET_FEED_ERRORS, PetFeedResult
} from "../../objects/PetFood";

export type PetFeedOutcome =
	| {
		success: true; result: PetFeedResult;
	}
	| {
		success: false; error: typeof PET_FEED_ERRORS.NOT_HUNGRY; pet: OwnedPet;
	}
	| {
		success: false; error: Exclude<typeof PET_FEED_ERRORS[keyof typeof PET_FEED_ERRORS], typeof PET_FEED_ERRORS.NOT_HUNGRY>;
	};

export class PetCaressRes extends FromServerPacket {
	public static readonly wireName = "PetCaressRes";
}

export class PetNickRes extends FromServerPacket {
	public static readonly wireName = "PetNickRes";

	public foundPet!: boolean;

	public newNickname?: string;

	public nickNameIsAcceptable?: boolean;
}

export class PetFeedRes extends FromServerPacket {
	public static readonly wireName = "PetFeedRes";

	public outcome!: PetFeedOutcome;
}
