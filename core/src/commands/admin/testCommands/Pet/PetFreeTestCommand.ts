import {ExecuteTestCommandLike, ITestCommand} from "../../../../core/CommandsTest";
import {LogsDatabase} from "../../../../core/database/logs/LogsDatabase";
import {PetEntities} from "../../../../core/database/game/models/PetEntity";

export const commandInfo: ITestCommand = {
	name: "petfree",
	aliases: ["pf"],
	description: "Libère votre pet de force, sans prendre en compte le cooldown"
};

/**
 * Same as petfree command, but doesn't care about cooldown
 */
const petFreeTestCommand: ExecuteTestCommandLike = async (player) => {
	if (player.petId === null) {
		throw new Error("Erreur petfree : vous n'avez pas de pet !");
	}
	const playerPet = await PetEntities.getById(player.petId);
	LogsDatabase.logPetFree(playerPet).then();
	await playerPet.destroy();
	player.petId = null;
	await player.save();
	return "Vous avez libéré votre pet de force !";
};

commandInfo.execute = petFreeTestCommand;