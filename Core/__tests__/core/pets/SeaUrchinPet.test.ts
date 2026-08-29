import {
	readFileSync
} from "node:fs";
import { resolve } from "node:path";
import {
	describe, expect, it
} from "vitest";
import { PetConstants } from "../../../../Lib/src/constants/PetConstants";
import { FightConstants } from "../../../../Lib/src/constants/FightConstants";
import { ItemRarity } from "../../../../Lib/src/constants/ItemConstants";
import { PET_EXPEDITION_PREFERENCES } from "../../../../Lib/src/constants/PetExpeditionPreferences";

type PetData = {
	rarity: ItemRarity;
	diet: string;
	force: number;
	speed: number;
	feedDelay: number;
	tags: string[];
};

const seaUrchinData = JSON.parse(
	readFileSync(resolve(__dirname, "../../../resources/pets/103.json"), "utf8")
) as PetData;

describe("sea urchin pet", () => {
	it("is a rare, low-force aquatic pet with a speed bonus", () => {
		expect(PetConstants.PETS.SEA_URCHIN).toBe(103);
		expect(seaUrchinData).toMatchObject({
			rarity: ItemRarity.RARE,
			diet: PetConstants.RESTRICTIVES_DIETS.HERBIVOROUS,
			force: 1,
			speed: 6,
			feedDelay: 4,
			tags: [PetConstants.TAGS.AQUATIC]
		});
	});

	it("retaliates with its spikes and prefers coastal expeditions", () => {
		const behavior = PetConstants.PET_BEHAVIORS.find(entry => entry.petIds.includes(PetConstants.PETS.SEA_URCHIN));

		expect(behavior?.behaviorId).toBe(FightConstants.FIGHT_ACTIONS.PET.REVENGE);
		expect(PET_EXPEDITION_PREFERENCES[PetConstants.PETS.SEA_URCHIN]).toEqual({
			liked: ["coast", "swamp"],
			disliked: ["desert", "mountain"]
		});
	});
});
