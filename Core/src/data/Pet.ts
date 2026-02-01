import { DataControllerNumber } from "./DataController";
import { Data } from "./Data";
import { PetConstants } from "../../../Lib/src/constants/PetConstants";
import { RandomUtils } from "../../../Lib/src/utils/RandomUtils";

export class Pet extends Data<number> {
	declare readonly rarity: number;

	declare readonly diet: string;

	declare readonly force: number;

	declare readonly speed: number;

	declare readonly feedDelay: number;


	/**
	 * Returns true if the pet can eat meat
	 */
	public canEatMeat(): boolean {
		return this.diet === PetConstants.RESTRICTIVES_DIETS.CARNIVOROUS || !this.diet;
	}

	/**
	 * Returns true if the pet can eat vegetables
	 */
	public canEatVegetables(): boolean {
		return this.diet === PetConstants.RESTRICTIVES_DIETS.HERBIVOROUS || !this.diet;
	}
}

export class PetDataController extends DataControllerNumber<Pet> {
	static readonly instance: PetDataController = new PetDataController("pets");

	private maxIdCache: number | null = null;

	newInstance(): Pet {
		return new Pet();
	}

	public getMaxId(): number {
		if (!this.maxIdCache) {
			this.maxIdCache = Math.max(...[...this.data.keys()].map(armor => armor));
		}

		return this.maxIdCache;
	}

	/**
	 * Get a random pet
	 */
	public getRandom(rarity = -1): Pet {
		let pets = this.getValuesArray();
		pets = pets.filter(pet => pet.rarity !== 0); // Rarity 0 is for the no pet slot
		if (rarity !== -1) {
			pets = pets.filter(pet => pet.rarity === rarity);
		}
		return RandomUtils.crowniclesRandom.pick(pets);
	}

	public getPetsCount(): number {
		return this.getValuesArray().length;
	}
}
