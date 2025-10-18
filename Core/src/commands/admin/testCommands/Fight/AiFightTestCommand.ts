import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { Players } from "../../../../core/database/game/models/Player";
import { ClassDataController } from "../../../../data/Class";
import { AiPlayerFighter } from "../../../../core/fights/fighter/AiPlayerFighter";
import { FightController } from "../../../../core/fights/FightController";
import { FightOvertimeBehavior } from "../../../../core/fights/FightOvertimeBehavior";
import { FightConstants } from "../../../../../../Lib/src/constants/FightConstants";
import { PetDataController } from "../../../../data/Pet";
import { PetEntities } from "../../../../core/database/game/models/PetEntity";
import * as fs from "fs";
import * as path from "path";

// Charger les traductions françaises
const frModels = JSON.parse(
	fs.readFileSync(
		path.join(__dirname, "../../../../../../Lang/fr/models.json"),
		"utf-8"
	)
) as {
	classes: Record<string, string>;
	pets: Record<string, string>;
};

/**
 * Get the name of a class from translations
 */
function getClassName(classId: number): string {
	return (frModels.classes as Record<string, string>)[classId.toString()] || `Classe #${classId}`;
}

/**
 * Get the name of a pet from translations
 * Uses male variant by default
 */
function getPetName(petId: number): string {
	const maleKey = `${petId}_male`;
	return (frModels.pets as Record<string, string>)[maleKey] || `Familier #${petId}`;
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

export const commandInfo: ITestCommand = {
	name: "aifight",
	aliases: ["aif", "aivs"],
	commandFormat: "<player1Id> <player2Id> [amount:1-10000]",
	typeWaited: {
		player1Id: TypeKey.INTEGER,
		player2Id: TypeKey.INTEGER,
		amount: TypeKey.INTEGER
	},
	description: "Lance un ou plusieurs combats entre deux joueurs contrôlés par l'IA (mode silencieux). Les IDs sont les IDs de la table Player (nombres). Paramètre optionnel : amount (1-10000, défaut 1) = nombre de combats."
};

/**
 * Execute an AI vs AI fight
 */
const aiFightTestCommand: ExecuteTestCommandLike = async (_player, args, response, context) => {
	const player1Id = parseInt(args[0], 10);
	const player2Id = parseInt(args[1], 10);
	const amount = args.length > 2 ? Math.min(Math.max(parseInt(args[2], 10), 1), 10000) : 1;
	const silentMode = true; // Les combats IA sont toujours silencieux

	// 1. Récupérer les deux joueurs
	const player1 = await Players.getById(player1Id);
	const player2 = await Players.getById(player2Id);

	if (!player1) {
		throw new Error(`Joueur 1 introuvable avec l'ID : ${player1Id}`);
	}

	if (!player2) {
		throw new Error(`Joueur 2 introuvable avec l'ID : ${player2Id}`);
	}

	// 2. Vérifier que les joueurs peuvent combattre
	if (player1.level < FightConstants.REQUIRED_LEVEL) {
		throw new Error(`Le joueur 1 (ID: ${player1.id}) doit être au moins niveau ${FightConstants.REQUIRED_LEVEL} pour combattre.`);
	}

	if (player2.level < FightConstants.REQUIRED_LEVEL) {
		throw new Error(`Le joueur 2 (ID: ${player2.id}) doit être au moins niveau ${FightConstants.REQUIRED_LEVEL} pour combattre.`);
	}

	// 3. Statistiques pour plusieurs combats
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

	// 4. Exécuter les combats
	for (let i = 0; i < amount; i++) {
		/*
		 * Créer les combattants IA
		 * Les deux joueurs utilisent AiPlayerFighter pour qu'ils soient contrôlés par l'IA
		 */
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

		// Stocker les stats des combattants (première itération seulement)
		if (stats.player1MaxEnergy === 0) {
			stats.player1MaxEnergy = fighter1.getMaxEnergy();
			stats.player2MaxEnergy = fighter2.getMaxEnergy();
		}

		// Créer le contrôleur de combat
		const fightController = new FightController(
			{
				fighter1: fighter1,
				fighter2: fighter2
			},
			FightOvertimeBehavior.END_FIGHT_DRAW,
			context,
			silentMode
		);

		// Définir un callback pour collecter les statistiques
		fightController.setEndCallback(fight => {
			const winner = fight.getWinner();
			const isDraw = fight.isADraw();

			if (isDraw) {
				stats.draws++;
			}
			else if (winner === 0) {
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

			// Calculer les dégâts infligés (PV max - PV restants de l'adversaire)
			const player1Damage = stats.player1MaxEnergy - Math.round(fighter2.getEnergy());
			const player2Damage = stats.player2MaxEnergy - Math.round(fighter1.getEnergy());

			stats.player1TotalDamageDealt += player1Damage;
			stats.player2TotalDamageDealt += player2Damage;

			// Calculer les dégâts par tour pour la médiane
			if (fight.turn > 0) {
				stats.player1DamagePerTurnList.push(player1Damage / fight.turn);
				stats.player2DamagePerTurnList.push(player2Damage / fight.turn);
			}

			return Promise.resolve();
		});

		// Lancer le combat
		await fightController.startFight(response);
	}

	// 5. Afficher les résultats
	const class1 = ClassDataController.instance.getById(player1.class);
	const class2 = ClassDataController.instance.getById(player2.class);

	// Récupérer les entités pet pour obtenir le typeId
	const petEntity1 = player1.petId ? await PetEntities.getById(player1.petId) : null;
	const petEntity2 = player2.petId ? await PetEntities.getById(player2.petId) : null;
	const pet1 = petEntity1 ? PetDataController.instance.getById(petEntity1.typeId) : null;
	const pet2 = petEntity2 ? PetDataController.instance.getById(petEntity2.typeId) : null;

	if (amount === 1) {
		// Pour un seul combat, afficher le résultat classique avec détails des joueurs
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

		resultMessage += `\n\n**Informations des joueurs :**`;
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
		resultMessage += `\n\n**Statistiques du combat :**`;
		resultMessage += `\n🗡️ Dégâts infligés par Joueur #${player1.id} : ${stats.player1TotalDamageDealt}`;
		resultMessage += `\n🗡️ Dégâts infligés par Joueur #${player2.id} : ${stats.player2TotalDamageDealt}`;
		resultMessage += `\n⏱️ Nombre de tours : ${stats.totalTurns}`;

		return resultMessage;
	}

	// Pour plusieurs combats, afficher un résumé détaillé
	const avgTurns = (stats.totalTurns / amount).toFixed(1);
	const avgPlayer1Energy = (stats.player1TotalEnergy / amount).toFixed(1);
	const avgPlayer2Energy = (stats.player2TotalEnergy / amount).toFixed(1);
	const avgPlayer1Damage = (stats.player1TotalDamageDealt / amount).toFixed(1);
	const avgPlayer2Damage = (stats.player2TotalDamageDealt / amount).toFixed(1);

	// Calculer les dégâts moyens par tour
	const avgPlayer1DamagePerTurn = (stats.player1TotalDamageDealt / stats.totalTurns).toFixed(2);
	const avgPlayer2DamagePerTurn = (stats.player2TotalDamageDealt / stats.totalTurns).toFixed(2);

	// Calculer la médiane des dégâts par tour
	const medianPlayer1DamagePerTurn = calculateMedian(stats.player1DamagePerTurnList).toFixed(2);
	const medianPlayer2DamagePerTurn = calculateMedian(stats.player2DamagePerTurnList).toFixed(2);

	const player1WinRate = ((stats.player1Wins / amount) * 100).toFixed(1);
	const player2WinRate = ((stats.player2Wins / amount) * 100).toFixed(1);
	const drawRate = ((stats.draws / amount) * 100).toFixed(1);
	const player1SurvivalRate = ((stats.player1TotalEnergy / (stats.player1MaxEnergy * amount)) * 100).toFixed(1);
	const player2SurvivalRate = ((stats.player2TotalEnergy / (stats.player2MaxEnergy * amount)) * 100).toFixed(1);

	let summary = `⚔️ **Résumé de ${amount} combats IA**\n\n`;

	summary += `**👥 Combattants :**\n`;
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
	summary += `\n\n`;

	summary += `**🏆 Résultats globaux :**\n`;
	summary += `• Joueur #${player1.id} : ${stats.player1Wins} victoires (${player1WinRate}%)\n`;
	summary += `• Joueur #${player2.id} : ${stats.player2Wins} victoires (${player2WinRate}%)\n`;
	summary += `• Matchs nuls : ${stats.draws} (${drawRate}%)\n\n`;

	summary += `**📊 Statistiques moyennes par combat :**\n`;
	summary += `• Tours : ${avgTurns} (min: ${stats.minTurns}, max: ${stats.maxTurns})\n`;
	summary += `• PV restants Joueur #${player1.id} : ${avgPlayer1Energy}/${stats.player1MaxEnergy} (${player1SurvivalRate}%)\n`;
	summary += `• PV restants Joueur #${player2.id} : ${avgPlayer2Energy}/${stats.player2MaxEnergy} (${player2SurvivalRate}%)\n\n`;

	summary += `**🗡️ Dégâts moyens par combat :**\n`;
	summary += `• Joueur #${player1.id} : ${avgPlayer1Damage} dégâts totaux\n`;
	summary += `• Joueur #${player2.id} : ${avgPlayer2Damage} dégâts totaux\n\n`;

	summary += `**⚔️ Dégâts par tour :**\n`;
	summary += `• Joueur #${player1.id} - Moyenne : ${avgPlayer1DamagePerTurn} DPT | Médiane : ${medianPlayer1DamagePerTurn} DPT\n`;
	summary += `• Joueur #${player2.id} - Moyenne : ${avgPlayer2DamagePerTurn} DPT | Médiane : ${medianPlayer2DamagePerTurn} DPT\n\n`;

	summary += `**⚖️ Analyse d'équilibre :**\n`;
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
};

commandInfo.execute = aiFightTestCommand;
