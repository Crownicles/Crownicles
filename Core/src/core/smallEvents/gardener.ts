import { SmallEventFuncs } from "../../data/SmallEvent";
import { Maps } from "../maps/Maps";
import { MapLinkDataController } from "../../data/MapLink";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { SmallEventGardenerPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventGardenerPacket";
import { PlayerSmallEvents } from "../database/game/models/PlayerSmallEvent";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";
import {
	PlantConstants, PlantId
} from "../../../../Lib/src/constants/PlantConstants";
import {
	PlayerPlantSlots
} from "../database/game/models/PlayerPlantSlot";
import { InventoryInfos } from "../database/game/models/InventoryInfo";
import {
	Home, Homes
} from "../database/game/models/Home";
import { HomeGardenSlots } from "../database/game/models/HomeGardenSlot";
import { PetEntities } from "../database/game/models/PetEntity";
import {
	PetDataController
} from "../../data/Pet";
import { PetConstants } from "../../../../Lib/src/constants/PetConstants";
import { ClassConstants } from "../../../../Lib/src/constants/ClassConstants";
import { InventorySlots } from "../database/game/models/InventorySlot";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import Player from "../database/game/models/Player";
import { MaterialDataController } from "../../data/Material";
import { Materials } from "../database/game/models/Material";
import { MaterialRarity } from "../../../../Lib/src/types/MaterialRarity";
import {
	EndCallback, ReactionCollectorInstance
} from "../utils/ReactionsCollector";
import { ReactionCollectorGardener } from "../../../../Lib/src/packets/interaction/ReactionCollectorGardener";
import { ReactionCollectorAcceptReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { BlockingUtils } from "../utils/BlockingUtils";
import { ItemRarity } from "../../../../Lib/src/constants/ItemConstants";

const GARDENER_INTERACTIONS = {
	SEED: "seed",
	ADVICE: "advice",
	PLANT: "plant",
	MATERIAL: "material"
} as const;

const FALLBACK_PROBABILITIES = {
	ADVICE: 0.4,
	PLANT: 0.8
};

const LUNAR_CYCLE_DAYS = 29.53058770576;
const REFERENCE_NEW_MOON = new Date(2000, 0, 6, 18, 14, 0).getTime();

function getMoonIllumination(): number {
	const daysSinceNewMoon = (Date.now() - REFERENCE_NEW_MOON) / (1000 * 60 * 60 * 24);
	const phase = (daysSinceNewMoon % LUNAR_CYCLE_DAYS) / LUNAR_CYCLE_DAYS;
	return (1 - Math.cos(2 * Math.PI * phase)) / 2;
}

function getFranceHour(): number {
	const formatter = new Intl.DateTimeFormat("fr-FR", {
		timeZone: "Europe/Paris",
		hour: "numeric",
		hour12: false
	});
	return parseInt(formatter.format(new Date()), 10);
}

function isNightInFrance(): boolean {
	const hour = getFranceHour();
	return hour >= 21 || hour < 6;
}

function isOnGardenerMapLink(mapLinkId: number): boolean {
	const link = MapLinkDataController.instance.getById(mapLinkId);
	if (!link) {
		return false;
	}
	return (PlantConstants.GARDENER_MAP_LINKS as readonly number[]).includes(Number(link.id));
}

/**
 * Determine the next seed the player can receive.
 * Returns the PlantId or null if no seed is available.
 */
async function getNextSeedId(player: Player, home: Home | null): Promise<PlantId | null> {
	const invInfo = await InventoryInfos.getOfPlayer(player.id);
	await PlayerPlantSlots.initializeSlots(player.id, invInfo.plantSlots);
	const seedSlot = await PlayerPlantSlots.getSeedSlot(player.id);

	if (seedSlot && seedSlot.plantId !== 0) {
		return null;
	}

	const homeLevel = home?.getLevel();
	const hasGarden = homeLevel !== null && homeLevel !== undefined && homeLevel.features.gardenPlots > 0;

	if (!hasGarden) {
		return PlantId.COMMON_HERB;
	}

	const gardenSlots = await HomeGardenSlots.getOfHome(home!.id);
	let highestPlanted = 0;
	for (const slot of gardenSlots) {
		if (slot.plantId > highestPlanted) {
			highestPlanted = slot.plantId;
		}
	}

	const nextSeed = highestPlanted + 1;
	return nextSeed > 10 ? null : nextSeed as PlantId;
}

type SeedConditionResult = {
	canObtain: boolean;
	conditionKey: string;
};

async function checkSeedConditions(player: Player, seedId: PlantId, home: Home | null): Promise<SeedConditionResult> {
	if (player.level < PlantConstants.SEED_LEVEL_REQUIREMENTS[seedId]) {
		return {
			canObtain: false,
			conditionKey: "needLevel"
		};
	}

	if (seedId > PlantId.COMMON_HERB) {
		const homeLevel = home?.getLevel();
		if (!homeLevel || homeLevel.features.gardenPlots === 0) {
			return {
				canObtain: false,
				conditionKey: "needGarden"
			};
		}
	}

	const cost = PlantConstants.SEED_COSTS[seedId];
	if (cost > 0 && player.money < cost) {
		return {
			canObtain: false,
			conditionKey: "needMoney"
		};
	}

	switch (seedId) {
		case PlantId.LUNAR_MOSS: {
			if (!isNightInFrance() || getMoonIllumination() <= 0.5) {
				return {
					canObtain: false,
					conditionKey: "needMoonlight"
				};
			}
			return {
				canObtain: true,
				conditionKey: "moon"
			};
		}
		case PlantId.NIGHT_MUSHROOM: {
			if (!isNightInFrance()) {
				return {
					canObtain: false,
					conditionKey: "needNight"
				};
			}
			return {
				canObtain: true,
				conditionKey: "night"
			};
		}
		case PlantId.VENOMOUS_LEAF:
			return await checkHerbivorePetCondition(player, false);
		case PlantId.FIRE_BULB:
			return await checkFireAffinityCondition(player);
		case PlantId.MEAT_PLANT:
			return await checkCarnivorePetCondition(player);
		case PlantId.ANCIENT_TREE:
			return await checkHerbivorePetCondition(player, true);
		default:
			break;
	}

	if (cost > 0) {
		return {
			canObtain: true,
			conditionKey: "paid"
		};
	}
	return {
		canObtain: true,
		conditionKey: "free"
	};
}

async function checkHerbivorePetCondition(player: Player, requireLegendary: boolean): Promise<SeedConditionResult> {
	if (!player.petId) {
		return {
			canObtain: false,
			conditionKey: requireLegendary ? "needLegendaryHerbivorePet" : "needHerbivorePet"
		};
	}

	const petEntity = await PetEntities.getById(player.petId);
	if (!petEntity) {
		return {
			canObtain: false,
			conditionKey: requireLegendary ? "needLegendaryHerbivorePet" : "needHerbivorePet"
		};
	}

	const petData = PetDataController.instance.getById(petEntity.typeId);
	if (!petData || !petData.canEatVegetables()) {
		return {
			canObtain: false,
			conditionKey: requireLegendary ? "needLegendaryHerbivorePet" : "needHerbivorePet"
		};
	}

	if (petEntity.lovePoints < PetConstants.TRAINED_LOVE_THRESHOLD) {
		return {
			canObtain: false,
			conditionKey: requireLegendary ? "needLegendaryHerbivorePet" : "needHerbivorePet"
		};
	}

	if (requireLegendary && petData.rarity < ItemRarity.EPIC) {
		return {
			canObtain: false,
			conditionKey: "needLegendaryHerbivorePet"
		};
	}

	return {
		canObtain: true,
		conditionKey: requireLegendary ? "legendaryHerbivorePet" : "herbivorePet"
	};
}

async function checkFireAffinityCondition(player: Player): Promise<SeedConditionResult> {
	if (player.class === ClassConstants.CLASSES_ID.MYSTIC_MAGE) {
		return {
			canObtain: true,
			conditionKey: "mage"
		};
	}

	if (player.petId) {
		const petEntity = await PetEntities.getById(player.petId);
		if (petEntity && petEntity.typeId === PetConstants.PETS.PHOENIX) {
			return {
				canObtain: true,
				conditionKey: "phoenix"
			};
		}
	}

	const weaponSlot = await InventorySlots.getMainWeaponSlot(player.id);
	if (weaponSlot && (PlantConstants.FIRE_ITEM_IDS.WEAPONS as readonly number[]).includes(weaponSlot.itemId)) {
		return {
			canObtain: true,
			conditionKey: "fireItem"
		};
	}

	const armorSlot = await InventorySlots.getMainArmorSlot(player.id);
	if (armorSlot && (PlantConstants.FIRE_ITEM_IDS.ARMORS as readonly number[]).includes(armorSlot.itemId)) {
		return {
			canObtain: true,
			conditionKey: "fireItem"
		};
	}

	const objectSlot = await InventorySlots.getMainObjectSlot(player.id);
	if (objectSlot && (PlantConstants.FIRE_ITEM_IDS.OBJECTS as readonly number[]).includes(objectSlot.itemId)) {
		return {
			canObtain: true,
			conditionKey: "fireItem"
		};
	}

	return {
		canObtain: false,
		conditionKey: "needFireAffinity"
	};
}

async function checkCarnivorePetCondition(player: Player): Promise<SeedConditionResult> {
	if (!player.petId) {
		return {
			canObtain: false,
			conditionKey: "needCarnivorePet"
		};
	}

	const petEntity = await PetEntities.getById(player.petId);
	if (!petEntity) {
		return {
			canObtain: false,
			conditionKey: "needCarnivorePet"
		};
	}

	const petData = PetDataController.instance.getById(petEntity.typeId);
	if (!petData || !petData.canEatMeat()) {
		return {
			canObtain: false,
			conditionKey: "needCarnivorePet"
		};
	}

	if (petData.rarity < ItemRarity.EPIC) {
		return {
			canObtain: false,
			conditionKey: "needCarnivorePet"
		};
	}

	return {
		canObtain: true,
		conditionKey: "carnivorePet"
	};
}

async function giveSeedToPlayer(response: CrowniclesPacket[], player: Player, seedId: PlantId, conditionKey: string): Promise<SmallEventGardenerPacket> {
	const cost = PlantConstants.SEED_COSTS[seedId];

	if (cost > 0) {
		await player.spendMoney({
			amount: cost,
			response,
			reason: NumberChangeReason.SMALL_EVENT
		});
		await player.save();
	}

	await PlayerPlantSlots.setSeed(player.id, seedId);

	return {
		interactionName: GARDENER_INTERACTIONS.SEED,
		plantId: seedId,
		materialId: 0,
		cost,
		conditionKey
	};
}

function getPaidSeedEndCallback(player: Player, seedId: PlantId, _conditionKey: string): EndCallback {
	return async (collector, response): Promise<void> => {
		const reaction = collector.getFirstReaction();

		if (reaction && reaction.reaction.type === ReactionCollectorAcceptReaction.name) {
			const cost = PlantConstants.SEED_COSTS[seedId];
			if (player.money >= cost) {
				const packet = await giveSeedToPlayer(response, player, seedId, "paidAccepted");
				response.push(makePacket(SmallEventGardenerPacket, packet));
			}
			else {
				response.push(makePacket(SmallEventGardenerPacket, {
					interactionName: GARDENER_INTERACTIONS.ADVICE,
					plantId: seedId,
					materialId: 0,
					cost: 0,
					conditionKey: "needMoney"
				}));
			}
		}
		else {
			response.push(makePacket(SmallEventGardenerPacket, {
				interactionName: GARDENER_INTERACTIONS.ADVICE,
				plantId: seedId,
				materialId: 0,
				cost: 0,
				conditionKey: "refused"
			}));
		}

		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.GARDENER_SMALL_EVENT);
	};
}

async function handleFallback(response: CrowniclesPacket[], player: Player, conditionKey: string, targetSeedId: number = 0): Promise<SmallEventGardenerPacket> {
	const roll = RandomUtils.crowniclesRandom.real(0, 1);

	if (roll < FALLBACK_PROBABILITIES.ADVICE) {
		return {
			interactionName: GARDENER_INTERACTIONS.ADVICE,
			plantId: targetSeedId,
			materialId: 0,
			cost: 0,
			conditionKey
		};
	}

	if (roll < FALLBACK_PROBABILITIES.PLANT) {
		return await handlePlantGift(player);
	}

	return await handleMaterialGift(response, player);
}

async function handlePlantGift(player: Player): Promise<SmallEventGardenerPacket> {
	const emptySlot = await PlayerPlantSlots.findEmptyPlantSlot(player.id);

	if (emptySlot) {
		const randomPlantId = PlantConstants.lootRandomPlant(RandomUtils.crowniclesRandom);
		await PlayerPlantSlots.setPlant(player.id, emptySlot.slot, randomPlantId);
		return {
			interactionName: GARDENER_INTERACTIONS.PLANT,
			plantId: randomPlantId,
			materialId: 0,
			cost: 0,
			conditionKey: ""
		};
	}

	return {
		interactionName: GARDENER_INTERACTIONS.ADVICE,
		plantId: 0,
		materialId: 0,
		cost: 0,
		conditionKey: "noPlantSpace"
	};
}

async function handleMaterialGift(_response: CrowniclesPacket[], player: Player): Promise<SmallEventGardenerPacket> {
	const material = MaterialDataController.instance.getRandomMaterialFromRarity(MaterialRarity.COMMON)
		?? MaterialDataController.instance.getRandomMaterialFromRarity(MaterialRarity.UNCOMMON);

	if (material) {
		await Materials.giveMaterial(player.id, parseInt(material.id, 10), 1);
		return {
			interactionName: GARDENER_INTERACTIONS.MATERIAL,
			plantId: 0,
			materialId: parseInt(material.id, 10),
			cost: 0,
			conditionKey: ""
		};
	}

	return {
		interactionName: GARDENER_INTERACTIONS.ADVICE,
		plantId: 0,
		materialId: 0,
		cost: 0,
		conditionKey: "allSeedsObtained"
	};
}

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: async player => {
		if (!Maps.isOnContinent(player)) {
			return false;
		}
		if (!isOnGardenerMapLink(player.mapLinkId)) {
			return false;
		}
		return await PlayerSmallEvents.playerSmallEventCount(player.id, SmallEventConstants.UNIQUE_EVENT_IDS.GARDENER) === 0;
	},
	executeSmallEvent: async (response: CrowniclesPacket[], player, context: PacketContext): Promise<void> => {
		const home = await Homes.getOfPlayer(player.id);
		const nextSeedId = await getNextSeedId(player, home);

		if (nextSeedId === null) {
			const seedSlot = await PlayerPlantSlots.getSeedSlot(player.id);
			const conditionKey = seedSlot && seedSlot.plantId !== 0 ? "seedSlotFull" : "allSeedsObtained";
			const packet = await handleFallback(response, player, conditionKey);
			response.push(makePacket(SmallEventGardenerPacket, packet));
			return;
		}

		const conditions = await checkSeedConditions(player, nextSeedId, home);

		if (!conditions.canObtain) {
			const packet = await handleFallback(response, player, conditions.conditionKey, nextSeedId);
			response.push(makePacket(SmallEventGardenerPacket, packet));
			return;
		}

		const cost = PlantConstants.SEED_COSTS[nextSeedId];

		if (cost > 0) {
			const collector = new ReactionCollectorGardener(nextSeedId, cost, conditions.conditionKey);
			const collectorPacket = new ReactionCollectorInstance(
				collector,
				context,
				{
					allowedPlayerKeycloakIds: [player.keycloakId]
				},
				getPaidSeedEndCallback(player, nextSeedId, conditions.conditionKey)
			)
				.block(player.keycloakId, BlockingConstants.REASONS.GARDENER_SMALL_EVENT)
				.build();
			response.push(collectorPacket);
		}
		else {
			const packet = await giveSeedToPlayer(response, player, nextSeedId, conditions.conditionKey);
			response.push(makePacket(SmallEventGardenerPacket, packet));
		}
	}
};
