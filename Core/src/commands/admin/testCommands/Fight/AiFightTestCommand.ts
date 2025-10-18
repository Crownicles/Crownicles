import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { Players } from "../../../../core/database/game/models/Player";
import { ClassDataController } from "../../../../data/Class";
import { AiPlayerFighter } from "../../../../core/fights/fighter/AiPlayerFighter";
import { FightController } from "../../../../core/fights/FightController";
import { FightOvertimeBehavior } from "../../../../core/fights/FightOvertimeBehavior";
import { FightConstants } from "../../../../../../Lib/src/constants/FightConstants";

export const commandInfo: ITestCommand = {
	name: "aifight",
	aliases: ["aif", "aivs"],
	commandFormat: "<player1Id> <player2Id> [amount:1-500] [silent:0|1]",
	typeWaited: {
		player1Id: TypeKey.INTEGER,
		player2Id: TypeKey.INTEGER,
		amount: TypeKey.INTEGER,
		silent: TypeKey.INTEGER
	},
	description: "Lance un ou plusieurs combats entre deux joueurs contrôlés par l'IA. Les IDs sont les IDs de la table Player (nombres). Paramètres optionnels : amount (1-500, défaut 1) = nombre de combats, silent (0|1, défaut 0) = mode silencieux."
};

/**
 * Execute an AI vs AI fight
 */
const aiFightTestCommand: ExecuteTestCommandLike = async (_player, args, response, context) => {
	const player1Id = parseInt(args[0], 10);
	const player2Id = parseInt(args[1], 10);
	const amount = args.length > 2 ? Math.min(Math.max(parseInt(args[2], 10), 1), 500) : 1;
	const silentMode = args.length > 3 ? parseInt(args[3], 10) === 1 : amount > 1;

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
		player2TotalEnergy: 0
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

			return Promise.resolve();
		});

		// Lancer le combat
		await fightController.startFight(response);
	}

	// 5. Afficher les résultats
	if (amount === 1) {
		// Pour un seul combat, afficher le résultat classique
		let resultMessage = "";
		if (stats.draws > 0) {
			resultMessage = `⚔️ Match nul entre Joueur ${player1.id} et Joueur ${player2.id} !`;
		}
		else if (stats.player1Wins > 0) {
			resultMessage = `🏆 Joueur ${player1.id} a vaincu Joueur ${player2.id} !`;
		}
		else {
			resultMessage = `🏆 Joueur ${player2.id} a vaincu Joueur ${player1.id} !`;
		}

		resultMessage += `\n\n**Statistiques finales :**`;
		resultMessage += `\nJoueur ${player1.id} : ${stats.player1TotalEnergy} PV`;
		resultMessage += `\nJoueur ${player2.id} : ${stats.player2TotalEnergy} PV`;
		resultMessage += `\n\nNombre de tours : ${stats.totalTurns}`;

		return resultMessage;
	}

	// Pour plusieurs combats, afficher un résumé
	const avgTurns = (stats.totalTurns / amount).toFixed(1);
	const avgPlayer1Energy = (stats.player1TotalEnergy / amount).toFixed(1);
	const avgPlayer2Energy = (stats.player2TotalEnergy / amount).toFixed(1);
	const player1WinRate = ((stats.player1Wins / amount) * 100).toFixed(1);
	const player2WinRate = ((stats.player2Wins / amount) * 100).toFixed(1);
	const drawRate = ((stats.draws / amount) * 100).toFixed(1);

	let summary = `⚔️ **Résumé de ${amount} combats entre Joueur ${player1.id} et Joueur ${player2.id}**\n\n`;
	summary += `**Résultats :**\n`;
	summary += `🏆 Joueur ${player1.id} : ${stats.player1Wins} victoires (${player1WinRate}%)\n`;
	summary += `🏆 Joueur ${player2.id} : ${stats.player2Wins} victoires (${player2WinRate}%)\n`;
	summary += `⚖️ Matchs nuls : ${stats.draws} (${drawRate}%)\n\n`;
	summary += `**Statistiques :**\n`;
	summary += `📊 Tours moyens : ${avgTurns} (min: ${stats.minTurns}, max: ${stats.maxTurns})\n`;
	summary += `❤️ PV moyens Joueur ${player1.id} : ${avgPlayer1Energy}\n`;
	summary += `❤️ PV moyens Joueur ${player2.id} : ${avgPlayer2Energy}`;

	return summary;
};

commandInfo.execute = aiFightTestCommand;
