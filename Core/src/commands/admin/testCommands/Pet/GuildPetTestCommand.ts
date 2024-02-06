import {GuildPets} from "../../../../core/database/game/models/GuildPet";
import {PetEntities} from "../../../../core/database/game/models/PetEntity";
import {Guilds} from "../../../../core/database/game/models/Guild";
import {ExecuteTestCommandLike, ITestCommand, TypeKey} from "../../../../core/CommandsTest";
import {PetDataController} from "../../../../data/Pet";

export const commandInfo: ITestCommand = {
	name: "guildpet",
	aliases: ["gp"],
	commandFormat: "<id> <sex = m/f>",
	typeWaited: {
		id: TypeKey.INTEGER,
		sex: TypeKey.STRING
	},
	description: "Ajoute un pet à votre shelter de guilde avec un id et un sexe donnés"
};

/**
 * Add a pet in your shelter with id and sex given
 */
const guildPetTestCommand: ExecuteTestCommandLike = async (player, args) => {
	const guild = await Guilds.getById(player.guildId);
	if (guild === null) {
		throw new Error("Erreur guildpet : Vous n'avez pas de guilde !");
	}

	if (guild.isPetShelterFull(await GuildPets.getOfGuild(guild.id))) {
		throw new Error("Erreur guildpet : Plus de place dans le shelter !");
	}

	if (!["m", "f"].includes(args[1])) {
		throw new Error("Erreur guildpet : sexe invalide.");
	}
	const maxIdPet = PetDataController.instance.getMaxId();
	const petId = parseInt(args[0], 10);
	if (petId >= maxIdPet || petId < 0) {
		throw new Error(`Erreur guildpet : id invalide. L'id doit être compris entre 0 et ${maxIdPet} !`);
	}

	const pet = PetEntities.createPet(petId, args[1], null);
	await pet.save();

	await GuildPets.addPet(guild, pet, true).save();

	return `Un pet a rejoint votre shelter :\n${pet.id /* TODO : i18n (pet.getPetDisplay(await Pets.getById(pet.petId), language)) */} !`;
};

commandInfo.execute = guildPetTestCommand;