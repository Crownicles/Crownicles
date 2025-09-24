import { Maps } from "../../../../core/maps/Maps";
import { NumberChangeReason } from "../../../../../../Lib/src/constants/LogsConstants";
import {
	ExecuteTestCommandLike, ITestCommand
} from "../../../../core/CommandsTest";
import { TravelTime } from "../../../../core/maps/TravelTime";
import { MapLinkDataController } from "../../../../data/MapLink";
import { InventorySlots } from "../../../../core/database/game/models/InventorySlot";

export const commandInfo: ITestCommand = {
	name: "skiptutorial",
	aliases: ["skiptuto", "init"],
	description: "Alternative aux premiers /report. Permet de sauter le tutoriel et d'initialiser votre joueur au niveau 1 avec 2000 points"
};

/**
 * Initialize the player
 */
const skipTutorialTestCommand: ExecuteTestCommandLike = async player => {
	player.level = 1;
	player.score = 2000;
	player.weeklyScore = 0;
	player.experience = 0;
	player.money = 0;
	player.defenseGloryPoints = 100;
	player.attackGloryPoints = 100;
	player.badges = null;
	player.effectEndDate = new Date();
	player.effectDuration = 0;
	await player.addHealth(player.getMaxHealth(await InventorySlots.getPlayerActiveObjects(player.id)), [], NumberChangeReason.TEST, await InventorySlots.getPlayerActiveObjects(player.id));
	await Maps.startTravel(player, MapLinkDataController.instance.getRandomLinkOnMainContinent(), 0);
	await TravelTime.removeEffect(player, NumberChangeReason.TEST);
	await player.save();

	return "Vous avez initialisé votre joueur !";
};

commandInfo.execute = skipTutorialTestCommand;
