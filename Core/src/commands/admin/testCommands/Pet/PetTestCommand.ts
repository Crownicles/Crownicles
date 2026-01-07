import { PetEntities } from "../../../../core/database/game/models/PetEntity";
import { MissionsController } from "../../../../core/missions/MissionsController";
import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { PetDataController } from "../../../../data/Pet";

// Generate pet id suggestions (sample of pet IDs with both sexes)
const maxPetId = PetDataController.instance.getMaxId();
const samplePetIds = [1, 2, 3, 5, 8, 10, 15, 20].filter(id => id <= maxPetId);
const petFullSuggestions: string[] = [
	"0 m", // Remove pet
	...samplePetIds.flatMap(id => [`${id} m`, `${id} f`])
].slice(0, 25);

export const commandInfo: ITestCommand = {
	name: "pet",
	commandFormat: "<id> <sex = m/f>",
	typeWaited: {
		id: TypeKey.INTEGER,
		sex: TypeKey.STRING
	},
	description: "Donne un familier spécifique avec l'ID et le sexe choisis. Utilisez ID 0 pour supprimer le pet actuel. Sexe: m=mâle, f=femelle. Voir Core/resources/pets/ pour les IDs",
	argSuggestions: {
		id: ["0", ...samplePetIds.map(id => id.toString())],
		sex: ["m", "f"]
	},
	fullSuggestions: petFullSuggestions
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

	pet = PetEntities.createPet(petId, args[1], null);
	await pet.save();
	player.setPet(pet);
	await player.save();
	await MissionsController.update(player, response, { missionId: "havePet" });

	pet = await PetEntities.getById(pet.id); // Recall needed to refresh the pet
	return `Vous avez un nouveau pet :\n${pet.typeId} !`;
};

commandInfo.execute = petTestCommand;
