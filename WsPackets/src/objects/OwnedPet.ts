export type PetSex = "m" | "f";

export type OwnedPet = {
	typeId: number;

	nickname: string;

	rarity: number;

	sex: PetSex;

	loveLevel: number;

	force: number;

	feedDelay: number;
};
