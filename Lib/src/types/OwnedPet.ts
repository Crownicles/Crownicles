import { SexTypeShort } from "../constants/StringConstants";

export interface OwnedPet {
	typeId: number;

	nickname: string;

	rarity: number;

	sex: SexTypeShort;

	loveLevel: number;

	force: number;

	feedDelay: number;
}
