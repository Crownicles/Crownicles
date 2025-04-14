import Guild from "../../../../core/database/game/models/Guild";
import { getFoodIndexOf } from "../../../../core/utils/FoodUtils";
import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { PetConstants } from "../../../../../../Lib/src/constants/PetConstants";

export const commandInfo: ITestCommand = {
	name: "setfood",
	aliases: ["sf"],
	commandFormat: "<foodType> <amount>",
	typeWaited: {
		foodType: TypeKey.STRING,
		amount: TypeKey.INTEGER
	},
	description: "Set le montant d'une ressource de nourriture de la guilde à un montant donné"
};

/**
 * Set le montant d'une ressource de nourriture de la guilde à un montant donné
 */
const setFoodTestCommand: ExecuteTestCommandLike = async (player, args) => {
	const guild = await Guild.findOne({ where: { id: player.guildId } });
	if (!guild) {
		throw new Error("Erreur sf : vous n'êtes pas dans une guilde !");
	}
	if (getFoodIndexOf(args[0]) === -1) {
		throw new Error(`Erreur sf : mauvaise nourriture entrée, nourritures autorisées : ${PetConstants.PET_FOOD_BY_ID.toString()}`);
	}
	guild.setDataValue(args[0], args[1]);
	await guild.save();
	return `Vous avez maintenant ${args[0]} de ${args[1]}!`;
};

commandInfo.execute = setFoodTestCommand;
