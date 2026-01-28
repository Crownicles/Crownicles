import { PetEntities } from "../../../../core/database/game/models/PetEntity";
import { MissionsController } from "../../../../core/missions/MissionsController";
import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { PetDataController } from "../../../../data/Pet";

export const commandInfo: ITestCommand = {
	name: "pet",
	commandFormat: "<id> <sex = m/f>",
	typeWaited: {
		id: TypeKey.INTEGER,
		sex: TypeKey.STRING
	},
	description: "Donne un familier spécifique avec l'ID et le sexe choisis. Utilisez ID 0 pour supprimer le pet actuel. Sexe: m=mâle, f=femelle. Voir Core/resources/pets/ pour les IDs"
};

/**
 * Give you a pet with id and sex given
 */
const petTestCommand: ExecuteTestCommandLike = async (player, args, response) => {
	let pet = await PetEntities.getById(player.petId);
	if (pet) {
		await pet.destroy();
	}

	if (args[0] === "0") {
		return "Vous n'avez plus de pet maintenant !";
	}
	if (!["m", "f"].includes(args[1])) {
		throw new Error("Erreur pet : sexe invalide.");
	}
	const maxIdPet = PetDataController.instance.getMaxId();
	const petId = parseInt(args[0], 10);
	if (petId > maxIdPet || petId < 0) {
		throw new Error(`Erreur pet : id invalide. L'id doit être compris entre 0 et ${maxIdPet} !`);
	}

	pet = PetEntities.createPet(petId, args[1], "");
	await pet.save();
	player.setPet(pet);
	await player.save();
	await MissionsController.update(player, response, { missionId: "havePet" });

	pet = (await PetEntities.getById(pet.id))!; // Recall needed to refresh the pet
	return `Vous avez un nouveau pet :\n${pet.typeId} !`;
};

commandInfo.execute = petTestCommand;
