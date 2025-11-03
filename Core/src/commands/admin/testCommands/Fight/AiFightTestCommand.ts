import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import {
	Player, Players
} from "../../../../core/database/game/models/Player";
import {
	Class, ClassDataController
} from "../../../../data/Class";
import { AiPlayerFighter } from "../../../../core/fights/fighter/AiPlayerFighter";
import { FightController } from "../../../../core/fights/FightController";
import { FightOvertimeBehavior } from "../../../../core/fights/FightOvertimeBehavior";
import { FightConstants } from "../../../../../../Lib/src/constants/FightConstants";
import {
	Pet, PetDataController
} from "../../../../data/Pet";
import { PetEntities } from "../../../../core/database/game/models/PetEntity";

/**
 * Get the name of a class from translations
 */
function getClassName(classId: number): string {
	return `Class #${classId}`;
}

/**
 * Get the name of a pet from translations
 * Uses male variant by default
 */
function getPetName(petId: number): string {
	return `Pet #${petId}`;
}

/**
 * Calculate the median of an array of numbers
 */
function calculateMedian(values: number[]): number {
	if (values.length === 0) {
		return 0;
	}

	const sorted = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);

	if (sorted.length % 2 === 0) {
		return (sorted[middle - 1] + sorted[middle]) / 2;
	}

	return sorted[middle];
}

/**
 * Validate that players can fight
 */
function validatePlayers(player1: Player | null, player2: Player | null, player1Id: number, player2Id: number): void {
	if (!player1) {
		throw new Error(`Joueur 1 introuvable avec l'ID : ${player1Id}`);
	}
	if (!player2) {
		throw new Error(`Joueur 2 introuvable avec l'ID : ${player2Id}`);
	}
	if (player1.level < FightConstants.REQUIRED_LEVEL) {
		throw new Error(`Le joueur 1 (ID: ${player1.id}) doit être au moins niveau ${FightConstants.REQUIRED_LEVEL} pour combattre.`);
	}
	if (player2.level < FightConstants.REQUIRED_LEVEL) {
		throw new Error(`Le joueur 2 (ID: ${player2.id}) doit être au moins niveau ${FightConstants.REQUIRED_LEVEL} pour combattre.`);
	}
}

interface FightResultParams {
	stats: FightStats;
	player1: Player;
	player2: Player;
	class1: Class;
	class2: Class;
	pet1: Pet | null;
	pet2: Pet | null;
}

interface FightStats {
	player1Wins: number;
	player2Wins: number;
	draws: number;
	totalTurns: number;
	minTurns: number;
	maxTurns: number;
	player1TotalEnergy: number;
	player2TotalEnergy: number;
	player1TotalDamageDealt: number;
	player2TotalDamageDealt: number;
	player1MaxEnergy: number;
	player2MaxEnergy: number;
	player1DamagePerTurnList: number[];
	player2DamagePerTurnList: number[];
}

/**
 * Build single fight result message
 */
function buildSingleFightResult(params: FightResultParams): string {
	const {
		stats, player1, player2, class1, class2, pet1, pet2
	} = params;
	let resultMessage = "";
	if (stats.draws > 0) {
		resultMessage = `⚔️ Match nul entre **Joueur #${player1.id}** et **Joueur #${player2.id}** !`;
	}
	else if (stats.player1Wins > 0) {
		resultMessage = `🏆 **Joueur #${player1.id}** a vaincu **Joueur #${player2.id}** !`;
	}
	else {
		resultMessage = `🏆 **Joueur #${player2.id}** a vaincu **Joueur #${player1.id}** !`;
	}

	resultMessage += "\n\n**Informations des joueurs :**";
	resultMessage += `\n👤 **Joueur #${player1.id}** - Niveau ${player1.level} - ${getClassName(class1.id)}`;
	resultMessage += `\n   ⚡ PV: ${stats.player1TotalEnergy}/${stats.player1MaxEnergy} | ⚔️ ATK: ${class1.getAttackValue(player1.level)} | 🛡️ DEF: ${class1.getDefenseValue(player1.level)} | 🚀 SPD: ${class1.getSpeedValue(player1.level)}`;
	if (pet1) {
		resultMessage += ` | 🐾 ${getPetName(pet1.id)}`;
	}
	resultMessage += `\n👤 **Joueur #${player2.id}** - Niveau ${player2.level} - ${getClassName(class2.id)}`;
	resultMessage += `\n   ⚡ PV: ${stats.player2TotalEnergy}/${stats.player2MaxEnergy} | ⚔️ ATK: ${class2.getAttackValue(player2.level)} | 🛡️ DEF: ${class2.getDefenseValue(player2.level)} | 🚀 SPD: ${class2.getSpeedValue(player2.level)}`;
	if (pet2) {
		resultMessage += ` | 🐾 ${getPetName(pet2.id)}`;
	}
	resultMessage += "\n\n**Statistiques du combat :**";
	resultMessage += `\n🗡️ Dégâts infligés par Joueur #${player1.id} : ${stats.player1TotalDamageDealt}`;
	resultMessage += `\n🗡️ Dégâts infligés par Joueur #${player2.id} : ${stats.player2TotalDamageDealt}`;
	resultMessage += `\n⏱️ Nombre de tours : ${stats.totalTurns}`;

	return resultMessage;
}

/**
 * Build multiple fights summary
 */
function buildMultipleFightsSummary(amount: number, params: FightResultParams): string {
	const {
		stats, player1, player2, class1, class2, pet1, pet2
	} = params;
	const avgTurns = (stats.totalTurns / amount).toFixed(1);
	const avgPlayer1Energy = (stats.player1TotalEnergy / amount).toFixed(1);
	const avgPlayer2Energy = (stats.player2TotalEnergy / amount).toFixed(1);
	const avgPlayer1Damage = (stats.player1TotalDamageDealt / amount).toFixed(1);
	const avgPlayer2Damage = (stats.player2TotalDamageDealt / amount).toFixed(1);
	const avgPlayer1DamagePerTurn = (stats.player1TotalDamageDealt / stats.totalTurns).toFixed(2);
	const avgPlayer2DamagePerTurn = (stats.player2TotalDamageDealt / stats.totalTurns).toFixed(2);
	const medianPlayer1DamagePerTurn = calculateMedian(stats.player1DamagePerTurnList).toFixed(2);
	const medianPlayer2DamagePerTurn = calculateMedian(stats.player2DamagePerTurnList).toFixed(2);
	const player1WinRate = ((stats.player1Wins / amount) * 100).toFixed(1);
	const player2WinRate = ((stats.player2Wins / amount) * 100).toFixed(1);
	const drawRate = ((stats.draws / amount) * 100).toFixed(1);
	const player1SurvivalRate = ((stats.player1TotalEnergy / (stats.player1MaxEnergy * amount)) * 100).toFixed(1);
	const player2SurvivalRate = ((stats.player2TotalEnergy / (stats.player2MaxEnergy * amount)) * 100).toFixed(1);

	let summary = `⚔️ **Résumé de ${amount} combats IA**\n\n`;
	summary += "**👥 Combattants :**\n";
	summary += `• **Joueur #${player1.id}** - Niveau ${player1.level} - ${getClassName(class1.id)}\n`;
	summary += `  ⚡ ${stats.player1MaxEnergy} PV | ⚔️ ${class1.getAttackValue(player1.level)} ATK | 🛡️ ${class1.getDefenseValue(player1.level)} DEF | 🚀 ${class1.getSpeedValue(player1.level)} SPD`;
	if (pet1) {
		summary += ` | 🐾 ${getPetName(pet1.id)}`;
	}
	summary += `\n• **Joueur #${player2.id}** - Niveau ${player2.level} - ${getClassName(class2.id)}\n`;
	summary += `  ⚡ ${stats.player2MaxEnergy} PV | ⚔️ ${class2.getAttackValue(player2.level)} ATK | 🛡️ ${class2.getDefenseValue(player2.level)} DEF | 🚀 ${class2.getSpeedValue(player2.level)} SPD`;
	if (pet2) {
		summary += ` | 🐾 ${getPetName(pet2.id)}`;
	}
	summary += "\n\n";
	summary += "**🏆 Résultats globaux :**\n";
	summary += `• Joueur #${player1.id} : ${stats.player1Wins} victoires (${player1WinRate}%)\n`;
	summary += `• Joueur #${player2.id} : ${stats.player2Wins} victoires (${player2WinRate}%)\n`;
	summary += `• Matchs nuls : ${stats.draws} (${drawRate}%)\n\n`;
	summary += "**📊 Statistiques moyennes par combat :**\n";
	summary += `• Tours : ${avgTurns} (min: ${stats.minTurns}, max: ${stats.maxTurns})\n`;
	summary += `• PV restants Joueur #${player1.id} : ${avgPlayer1Energy}/${stats.player1MaxEnergy} (${player1SurvivalRate}%)\n`;
	summary += `• PV restants Joueur #${player2.id} : ${avgPlayer2Energy}/${stats.player2MaxEnergy} (${player2SurvivalRate}%)\n\n`;
	summary += "**🗡️ Dégâts moyens par combat :**\n";
	summary += `• Joueur #${player1.id} : ${avgPlayer1Damage} dégâts totaux\n`;
	summary += `• Joueur #${player2.id} : ${avgPlayer2Damage} dégâts totaux\n\n`;
	summary += "**⚔️ Dégâts par tour :**\n";
	summary += `• Joueur #${player1.id} - Moyenne : ${avgPlayer1DamagePerTurn} DPT | Médiane : ${medianPlayer1DamagePerTurn} DPT\n`;
	summary += `• Joueur #${player2.id} - Moyenne : ${avgPlayer2DamagePerTurn} DPT | Médiane : ${medianPlayer2DamagePerTurn} DPT\n\n`;
	summary += "**⚖️ Analyse d'équilibre :**\n";
	const winDiff = Math.abs(stats.player1Wins - stats.player2Wins);
	const winDiffPercent = parseFloat(((winDiff / amount) * 100).toFixed(1));
	if (winDiffPercent < 5) {
		summary += `✅ Équilibrage excellent (différence: ${winDiffPercent}%)`;
	}
	else if (winDiffPercent < 10) {
		summary += `⚠️ Équilibrage acceptable (différence: ${winDiffPercent}%)`;
	}
	else {
		const stronger = stats.player1Wins > stats.player2Wins ? `Joueur #${player1.id}` : `Joueur #${player2.id}`;
		summary += `❌ Déséquilibre détecté (différence: ${winDiffPercent}%) - ${stronger} est avantagé(e)`;
	}

	return summary;
}

export const commandInfo: ITestCommand = {
	name: "aifight",
	aliases: ["aif", "aivs"],
	commandFormat: "<player1Id> <player2Id> [amount:1-10000]",
	typeWaited: {
		player1Id: TypeKey.INTEGER,
		player2Id: TypeKey.INTEGER,
		amount: TypeKey.INTEGER
	},
	minArgs: 2, // Only the first 2 parameters are required
	description: "Lance un ou plusieurs combats entre deux joueurs contrôlés par l'IA (mode silencieux). Les IDs sont les IDs de la table Player (nombres). Paramètre optionnel : amount (1-10000, défaut 1) = nombre de combats."
};

/**
 * Execute an AI vs AI fight
 */
const aiFightTestCommand: ExecuteTestCommandLike = async (_player, args, response, context) => {
	const player1Id = parseInt(args[0], 10);
	const player2Id = parseInt(args[1], 10);
	const amount = args.length > 2 ? Math.min(Math.max(parseInt(args[2], 10), 1), 10000) : 1;
	const silentMode = true;

	const player1 = await Players.getById(player1Id);
	const player2 = await Players.getById(player2Id);

	validatePlayers(player1, player2, player1Id, player2Id);

	const stats = {
		player1Wins: 0,
		player2Wins: 0,
		draws: 0,
		totalTurns: 0,
		minTurns: Infinity,
		maxTurns: 0,
		player1TotalEnergy: 0,
		player2TotalEnergy: 0,
		player1TotalDamageDealt: 0,
		player2TotalDamageDealt: 0,
		player1MaxEnergy: 0,
		player2MaxEnergy: 0,
		player1DamagePerTurnList: [] as number[],
		player2DamagePerTurnList: [] as number[]
	};

	for (let i = 0; i < amount; i++) {
		const fighter1 = new AiPlayerFighter(
			player1,
			ClassDataController.instance.getById(player1.class)
		);
		await fighter1.loadStats();

		const fighter2 = new AiPlayerFighter(
			player2,
			ClassDataController.instance.getById(player2.class)
		);
		await fighter2.loadStats();

		if (stats.player1MaxEnergy === 0) {
			stats.player1MaxEnergy = fighter1.getMaxEnergy();
			stats.player2MaxEnergy = fighter2.getMaxEnergy();
		}

		const fightController = new FightController(
			{
				fighter1,
				fighter2
			},
			FightOvertimeBehavior.END_FIGHT_DRAW,
			context,
			silentMode
		);

		fightController.setEndCallback(fight => {
			const winner = fight.getWinnerFighter();
			const isDraw = fight.isADraw();

			if (isDraw) {
				stats.draws++;
			}
			else if (winner === fighter1) {
				stats.player1Wins++;
			}
			else {
				stats.player2Wins++;
			}

			stats.totalTurns += fight.turn;
			stats.minTurns = Math.min(stats.minTurns, fight.turn);
			stats.maxTurns = Math.max(stats.maxTurns, fight.turn);
			stats.player1TotalEnergy += Math.round(fighter1.getEnergy());
			stats.player2TotalEnergy += Math.round(fighter2.getEnergy());

			const player1Damage = stats.player1MaxEnergy - Math.round(fighter2.getEnergy());
			const player2Damage = stats.player2MaxEnergy - Math.round(fighter1.getEnergy());

			stats.player1TotalDamageDealt += player1Damage;
			stats.player2TotalDamageDealt += player2Damage;

			if (fight.turn > 0) {
				stats.player1DamagePerTurnList.push(player1Damage / fight.turn);
				stats.player2DamagePerTurnList.push(player2Damage / fight.turn);
			}

			return Promise.resolve();
		});

		await fightController.startFight(response);
	}

	const class1 = ClassDataController.instance.getById(player1.class);
	const class2 = ClassDataController.instance.getById(player2.class);
	const petEntity1 = player1.petId ? await PetEntities.getById(player1.petId) : null;
	const petEntity2 = player2.petId ? await PetEntities.getById(player2.petId) : null;
	const pet1 = petEntity1 ? PetDataController.instance.getById(petEntity1.typeId) : null;
	const pet2 = petEntity2 ? PetDataController.instance.getById(petEntity2.typeId) : null;

	const resultParams: FightResultParams = {
		stats,
		player1,
		player2,
		class1,
		class2,
		pet1,
		pet2
	};

	if (amount === 1) {
		return buildSingleFightResult(resultParams);
	}

	return buildMultipleFightsSummary(amount, resultParams);
};

commandInfo.execute = aiFightTestCommand;
