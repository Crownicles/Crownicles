import {
	ExecuteTestCommandLike, ITestCommand
} from "../../../../core/CommandsTest";
import { LogsDatabase } from "../../../../core/database/logs/LogsDatabase";
import { PetEntities } from "../../../../core/database/game/models/PetEntity";

export const commandInfo: ITestCommand = {
	name: "petfree",
	aliases: ["pf"],
	description: "Libère immédiatement le familier actuel sans attendre le cooldown normal. Le familier est retiré de l'inventaire du joueur"
};

/**
 * Same as petfree command, but doesn't care about cooldown
 */
const petFreeTestCommand: ExecuteTestCommandLike = async player => {
	if (!player.petId) {
		throw new Error("Erreur petfree : vous n'avez pas de pet !");
	}
	const playerPet = await PetEntities.getById(player.petId);
	if (!playerPet) {
		throw new Error("Erreur petfree : pet introuvable !");
	}
	LogsDatabase.logPetFree(playerPet).then();
	await playerPet.destroy();
	(player.petId as number | null) = null;
	await player.save();
	return "Vous avez libéré votre pet de force !";
};

commandInfo.execute = petFreeTestCommand;
