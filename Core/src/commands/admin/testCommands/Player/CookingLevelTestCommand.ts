import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { RecipeDiscoveryService } from "../../../../core/cooking/RecipeDiscoveryService";

const MAX_COOKING_LEVEL = 1000;

export const commandInfo: ITestCommand = {
	name: "cookinglevel",
	aliases: ["cooklvl"],
	commandFormat: "<niveau>",
	typeWaited: { niveau: TypeKey.INTEGER },
	description: "Définit le niveau de cuisine du joueur testeur et débloque les recettes associées."
};

const cookingLevelTestCommand: ExecuteTestCommandLike = async (player, args) => {
	const level = parseInt(args[0], 10);
	if (level <= 0 || level > MAX_COOKING_LEVEL) {
		throw new Error(`Erreur niveau de cuisine : le niveau doit être compris entre 1 et ${MAX_COOKING_LEVEL} !`);
	}

	player.cookingLevel = level;
	player.cookingExperience = 0;
	const discoveredRecipes = await RecipeDiscoveryService.discoverCookingLevelRecipes(player);
	await player.save();

	return `Votre niveau de cuisine est maintenant ${player.cookingLevel}. ${discoveredRecipes.length} recette(s) débloquée(s).`;
};

commandInfo.execute = cookingLevelTestCommand;
