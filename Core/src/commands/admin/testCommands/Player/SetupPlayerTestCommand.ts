import {
	ExecuteTestCommandLike, ITestCommand
} from "../../../../core/CommandsTest";
import { NumberChangeReason } from "../../../../../../Lib/src/constants/LogsConstants";
import { Maps } from "../../../../core/maps/Maps";
import { TravelTime } from "../../../../core/maps/TravelTime";
import { MapLinkDataController } from "../../../../data/MapLink";
import { PlayerMissionsInfos } from "../../../../core/database/game/models/PlayerMissionsInfo";
import { PetEntities } from "../../../../core/database/game/models/PetEntity";
import { MissionsController } from "../../../../core/missions/MissionsController";
import { generateRandomItem } from "../../../../core/utils/ItemUtils";
import {
	ItemCategory, ItemRarity
} from "../../../../../../Lib/src/constants/ItemConstants";
import { PetDataController } from "../../../../data/Pet";
import { PetConstants } from "../../../../../../Lib/src/constants/PetConstants";
import { RandomUtils } from "../../../../../../Lib/src/utils/RandomUtils";
import { crowniclesInstance } from "../../../../index";

const SETUP_DEFAULTS = {
	level: 30,
	money: 5000,
	gems: 50,
	score: 15000,
	gloryPoints: 500,
	minItemRarity: ItemRarity.UNCOMMON,
	maxItemRarity: ItemRarity.RARE
};

export const commandInfo: ITestCommand = {
	name: "setup",
	aliases: ["setupplayer", "fullsetup"],
	description: "Configure un joueur prêt à tester : niveau 30, argent, gemmes, pet aléatoire, équipement aléatoire, voyage en cours"
};

/**
 * Set up a player with everything needed for testing
 */
const setupPlayerTestCommand: ExecuteTestCommandLike = async (player, _args, response, _context) => {
	const results: string[] = [];

	// Level & stats
	player.level = SETUP_DEFAULTS.level;
	player.score = SETUP_DEFAULTS.score;
	player.weeklyScore = 0;
	player.experience = 0;
	player.defenseGloryPoints = SETUP_DEFAULTS.gloryPoints;
	player.attackGloryPoints = SETUP_DEFAULTS.gloryPoints;
	player.effectEndDate = new Date();
	player.effectDuration = 0;
	player.setHealthNoCheck(player.getMaxHealthBase());
	crowniclesInstance.logsDatabase.logLevelChange(player.keycloakId, player.level).then();
	results.push(`Niveau ${SETUP_DEFAULTS.level}, ${SETUP_DEFAULTS.score} points`);

	// Money
	await player.addMoney({
		amount: SETUP_DEFAULTS.money - player.money,
		response,
		reason: NumberChangeReason.TEST
	});
	results.push(`${SETUP_DEFAULTS.money} :moneybag:`);

	// Gems
	const missionInfo = await PlayerMissionsInfos.getOfPlayer(player.id);
	const gemsToAdd = SETUP_DEFAULTS.gems - missionInfo.gems;
	if (gemsToAdd !== 0) {
		await missionInfo.addGems(gemsToAdd, player.keycloakId, NumberChangeReason.TEST);
		await missionInfo.save();
	}
	results.push(`${SETUP_DEFAULTS.gems} :gem:`);

	// Pet (random)
	const existingPet = await PetEntities.getById(player.petId);
	if (existingPet) {
		await existingPet.destroy();
	}
	const maxPetId = PetDataController.instance.getMaxId();
	const petId = RandomUtils.crowniclesRandom.integer(1, maxPetId);
	const petSex = RandomUtils.crowniclesRandom.bool() ? PetConstants.SEX.MALE : PetConstants.SEX.FEMALE;
	const pet = PetEntities.createPet(petId, petSex, "");
	await pet.save();
	player.setPet(pet);
	await MissionsController.update(player, response, { missionId: "havePet" });
	results.push(`Pet #${petId} (${petSex})`);

	// Equipment (random items for each category)
	const categories = [
		ItemCategory.WEAPON,
		ItemCategory.ARMOR,
		ItemCategory.POTION,
		ItemCategory.OBJECT
	];
	const categoryNames = [
		"Arme",
		"Armure",
		"Potion",
		"Objet"
	];
	for (let i = 0; i < categories.length; i++) {
		const item = generateRandomItem({
			itemCategory: categories[i],
			minRarity: SETUP_DEFAULTS.minItemRarity,
			maxRarity: SETUP_DEFAULTS.maxItemRarity
		});
		await player.giveItem(item);
		results.push(`${categoryNames[i]} #${item.id}`);
	}

	// Start travel
	await Maps.startTravel(player, MapLinkDataController.instance.getRandomLinkOnMainContinent(), 0);
	await TravelTime.removeEffect(player, NumberChangeReason.TEST);
	results.push("Voyage lancé");

	await player.save();

	return `Joueur configuré !\n${results.join(" | ")}`;
};

commandInfo.execute = setupPlayerTestCommand;
