import { generateRandomRarity } from "../../../../core/utils/ItemUtils";
import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";

export const commandInfo: ITestCommand = {
	name: "rarityshot",
	aliases: ["rs"],
	commandFormat: "<nbTirages> <rarityMin = 1> <rarityMax = 8>",
	typeWaited: {
		nbTirages: TypeKey.INTEGER,
		rarityMin: TypeKey.INTEGER,
		rarityMax: TypeKey.INTEGER
	},
	description: "Teste le générateur de rareté d'objets en effectuant X tirages entre les raretés min et max spécifiées. Raretés valides : 1-8. Affiche les statistiques de distribution",
	argSuggestions: {
		nbTirages: ["10", "100", "1000", "10000"],
		rarityMin: ["1", "2", "3", "4"],
		rarityMax: ["5", "6", "7", "8"]
	},
	fullSuggestions: [
		"100 1 8", "1000 1 8", "10000 1 8",
		"100 1 4", "100 5 8",
		"1000 1 4", "1000 5 8"
	]
};

/**
 * Checks if the given values are eligible for a rarity shot
 */
function checkShotValues(nbShots: number, min: number, max: number): void {
	let errStr = "";
	if (nbShots < 0) {
		errStr += "Erreur rarityshot : nbTirages négatif !\n";
	}
	if (min > max) {
		errStr += "Erreur rarityshot : borne min inférieure à borne max !\n";
	}
	if (min > 8 || min < 1) {
		errStr += "Erreur rarityshot : borne min hors valeur (valeurs autorisées : 1 à 8) !\n";
	}
	if (max > 8 || max < 1) {
		errStr += "Erreur rarityshot : borne max hors valeur (valeurs autorisées : 1 à 8) !\n";
	}
	if (errStr !== "") {
		throw new Error(errStr);
	}
}

/**
 * Transform a count to a percent
 */
function countToPercent(value: number, total: number): number {
	return Math.round(value / total * 10000) / 100;
}

/**
 * Do random rarity tries
 */
const rarityShotTestCommand: ExecuteTestCommandLike = (_player, args) => {
	const nbShots = parseInt(args[0], 10);
	const min = parseInt(args[1], 10);
	const max = parseInt(args[2], 10);
	checkShotValues(nbShots, min, max);
	const tab = [
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0
	];
	for (let i = 0; i < nbShots; i++) {
		tab[generateRandomRarity(min, max) - 1]++;
	}
	const percents = tab.map(value => countToPercent(value, nbShots));
	return `Vous avez tiré ${nbShots} objets.
Vous avez obtenu :
- ${tab[0]} communs (${percents[0]}%)
- ${tab[1]} peu communs (${percents[1]}%)
- ${tab[2]} exotiques (${percents[2]}%)
- ${tab[3]} rares (${percents[3]}%)
- ${tab[4]} spéciaux (${percents[4]}%)
- ${tab[5]} épiques (${percents[5]}%)
- ${tab[6]} légendaires (${percents[6]}%)
- ${tab[7]} mythiques (${percents[7]}%)`;
};

commandInfo.execute = rarityShotTestCommand;
