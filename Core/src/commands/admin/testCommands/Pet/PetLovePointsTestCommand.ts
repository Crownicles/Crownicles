import { NumberChangeReason } from "../../../../../../Lib/src/constants/LogsConstants";
import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { PetEntities } from "../../../../core/database/game/models/PetEntity";
import { PetConstants } from "../../../../../../Lib/src/constants/PetConstants";

export const commandInfo: ITestCommand = {
	name: "petlovepoints",
	aliases: ["petlp"],
	commandFormat: "<lovePoints>",
	typeWaited: {
		lovePoints: TypeKey.INTEGER
	},
	description: "Définit le niveau d'amour (love points) du familier actuel. Les points d'amour influencent les capacités et l'efficacité du pet"
};

/**
 * Set the lovePoints of your pet
 */
const petLovePointsTestCommand: ExecuteTestCommandLike = async (player, args, response) => {
	const pet = await PetEntities.getById(player.petId);
	if (!pet) {
		throw new Error("Erreur petlp : vous n'avez pas de pet !");
	}
	const lovePoints = parseInt(args[0], 10);
	if (lovePoints < 0 || lovePoints > PetConstants.MAX_LOVE_POINTS) {
		throw new Error(`Erreur petlp : lovePoints invalide ! Fourchette de lovePoints comprise entre 0 et ${PetConstants.MAX_LOVE_POINTS}.`);
	}
	await pet.changeLovePoints({
		player,
		amount: lovePoints - pet.lovePoints,
		response,
		reason: NumberChangeReason.TEST
	});
	await pet.save();
	return `Votre pet a maintenant un amour de ${args[0]}.`;
};

commandInfo.execute = petLovePointsTestCommand;
