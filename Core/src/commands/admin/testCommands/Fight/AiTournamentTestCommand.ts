import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import {
	Player
} from "../../../../core/database/game/models/Player";
import { ClassDataController } from "../../../../data/Class";
import { AiPlayerFighter } from "../../../../core/fights/fighter/AiPlayerFighter";
import { FightController } from "../../../../core/fights/FightController";
import { FightOvertimeBehavior } from "../../../../core/fights/FightOvertimeBehavior";
import { FightConstants } from "../../../../../../Lib/src/constants/FightConstants";
import { PetDataController } from "../../../../data/Pet";
import { PetEntities } from "../../../../core/database/game/models/PetEntity";
import { Op } from "sequelize";
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

interface PlayerStats {
	playerId: number;
	playerName: string;
	level: number;
	classId: number;
	className: string;
	petTypeId: number | null;
	petName: string | null;
	maxEnergy: number;
	attack: number;
	defense: number;
	speed: number;
	wins: number;
	losses: number;
	draws: number;
	totalDamageDealt: number;
	totalDamageTaken: number;
	totalTurns: number;
	damagePerTurnList: number[];
	opponentsBeaten: Set<number>;
	opponentsLostTo: Set<number>;
}

interface ClassMatchup {
	wins: number;
	losses: number;
	draws: number;
}

interface PetMatchup {
	wins: number;
	losses: number;
	draws: number;
}

export const commandInfo: ITestCommand = {
	name: "aitournament",
	aliases: ["ait", "tournament"],
	commandFormat: "[fightsPerPair:100-10000]",
	typeWaited: {
		fightsPerPair: TypeKey.INTEGER
	},
	description: "Lance un tournoi IA entre tous les joueurs niveau 8+ de la base de données. Paramètre optionnel : fightsPerPair (100-10000, défaut 5000) = nombre de combats par paire."
};

/**
 * Execute an AI tournament
 */
const aiTournamentTestCommand: ExecuteTestCommandLike = async (_player, args, response, context) => {
	const fightsPerPair = args.length > 0 ? Math.min(Math.max(parseInt(args[0], 10), 100), 10000) : 5000;
	const minLevel = FightConstants.REQUIRED_LEVEL;

	// 1. Récupérer tous les joueurs éligibles (niveau 8+)
	const allPlayers = await Player.findAll({
		where: {
			level: {
				[Op.gte]: minLevel
			}
		}
	});

	// Filtrer les joueurs qui peuvent combattre
	const eligiblePlayers = allPlayers.filter((p: Player) => p.level >= FightConstants.REQUIRED_LEVEL);

	if (eligiblePlayers.length < 2) {
		return `❌ Pas assez de joueurs éligibles pour un tournoi (minimum 2 requis, ${eligiblePlayers.length} trouvé(s) avec niveau ${minLevel}+).`;
	}

	// 2. Initialiser les statistiques pour chaque joueur
	const playerStatsMap = new Map<number, PlayerStats>();

	for (const player of eligiblePlayers) {
		const classData = ClassDataController.instance.getById(player.class);
		const petEntity = player.petId ? await PetEntities.getById(player.petId) : null;
		const petData = petEntity ? PetDataController.instance.getById(petEntity.typeId) : null;

		playerStatsMap.set(player.id, {
			playerId: player.id,
			playerName: `Joueur #${player.id}`,
			level: player.level,
			classId: player.class,
			className: getClassName(player.class),
			petTypeId: petEntity?.typeId || null,
			petName: petData ? getPetName(petData.id) : null,
			maxEnergy: classData.getMaxHealthValue(player.level),
			attack: classData.getAttackValue(player.level),
			defense: classData.getDefenseValue(player.level),
			speed: classData.getSpeedValue(player.level),
			wins: 0,
			losses: 0,
			draws: 0,
			totalDamageDealt: 0,
			totalDamageTaken: 0,
			totalTurns: 0,
			damagePerTurnList: [],
			opponentsBeaten: new Set(),
			opponentsLostTo: new Set()
		});
	}

	// 3. Statistiques de matchups classe vs classe et pet vs pet
	const classMatchups = new Map<string, ClassMatchup>();
	const petMatchups = new Map<string, PetMatchup>();

	// 4. Simuler tous les combats
	const totalPairs = (eligiblePlayers.length * (eligiblePlayers.length - 1)) / 2;
	const totalFights = totalPairs * fightsPerPair;

	response.push({
		commandName: "aitournament",
		result: `🏆 **Démarrage du tournoi IA**\n\n`
			+ `👥 Participants : ${eligiblePlayers.length} joueurs (niveau ${minLevel}+)\n`
			+ `⚔️ Combats par paire : ${fightsPerPair}\n`
			+ `📊 Total de paires : ${totalPairs}\n`
			+ `🎯 Total de combats : ${totalFights.toLocaleString()}\n\n`
			+ `⏳ Simulation en cours...`,
		isError: false
	});

	let completedFights = 0;
	const startTime = Date.now();
	let lastProgressUpdate = Date.now();
	const progressUpdateIntervalMs = 5000; // Mise à jour toutes les 5 secondes

	for (let i = 0; i < eligiblePlayers.length; i++) {
		for (let j = i + 1; j < eligiblePlayers.length; j++) {
			const player1 = eligiblePlayers[i];
			const player2 = eligiblePlayers[j];
			const stats1 = playerStatsMap.get(player1.id)!;
			const stats2 = playerStatsMap.get(player2.id)!;

			// Statistiques pour cette paire
			let p1Wins = 0;
			let p2Wins = 0;
			let draws = 0;

			// Simuler les combats entre cette paire
			for (let fight = 0; fight < fightsPerPair; fight++) {
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

				const fightController = new FightController(
					{
						fighter1: fighter1,
						fighter2: fighter2
					},
					FightOvertimeBehavior.END_FIGHT_DRAW,
					context,
					true // Silent mode
				);

				// Définir un callback pour collecter les statistiques
				fightController.setEndCallback(fightResult => {
					const winner = fightResult.getWinner();
					const isDraw = fightResult.isADraw();

					const p1Energy = Math.round(fighter1.getEnergy());
					const p2Energy = Math.round(fighter2.getEnergy());

					const p1Damage = stats1.maxEnergy - p2Energy;
					const p2Damage = stats2.maxEnergy - p1Energy;

					stats1.totalDamageDealt += p1Damage;
					stats1.totalDamageTaken += p2Damage;
					stats2.totalDamageDealt += p2Damage;
					stats2.totalDamageTaken += p1Damage;

					stats1.totalTurns += fightResult.turn;
					stats2.totalTurns += fightResult.turn;

					if (fightResult.turn > 0) {
						stats1.damagePerTurnList.push(p1Damage / fightResult.turn);
						stats2.damagePerTurnList.push(p2Damage / fightResult.turn);
					}

					if (isDraw) {
						draws++;
						stats1.draws++;
						stats2.draws++;
					}
					else if (winner === 0) {
						p1Wins++;
						stats1.wins++;
						stats2.losses++;
						stats1.opponentsBeaten.add(player2.id);
						stats2.opponentsLostTo.add(player1.id);
					}
					else {
						p2Wins++;
						stats2.wins++;
						stats1.losses++;
						stats2.opponentsBeaten.add(player1.id);
						stats1.opponentsLostTo.add(player2.id);
					}

					return Promise.resolve();
				});

				await fightController.startFight(response);

				// Incrémenter le compteur et afficher la progression
				completedFights++;

				const now = Date.now();
				if (now - lastProgressUpdate >= progressUpdateIntervalMs) {
					const progress = (completedFights / totalFights * 100).toFixed(1);
					const fightsPerSecond = completedFights / ((now - startTime) / 1000);
					const estimatedTimeRemaining = Math.ceil((totalFights - completedFights) / fightsPerSecond);

					response.push({
						commandName: "aitournament",
						result: `⏳ Progression : ${completedFights.toLocaleString()}/${totalFights.toLocaleString()} (${progress}%)\n`
							+ `⚡ Vitesse : ${fightsPerSecond.toFixed(1)} combats/s\n`
							+ `⏱️ Temps restant estimé : ${Math.floor(estimatedTimeRemaining / 60)}m ${estimatedTimeRemaining % 60}s`,
						isError: false
					});

					lastProgressUpdate = now;
				}
			}

			// Enregistrer les matchups classe vs classe
			const classKey = `${stats1.classId}-${stats2.classId}`;
			const reverseClassKey = `${stats2.classId}-${stats1.classId}`;

			if (!classMatchups.has(classKey)) {
				classMatchups.set(classKey, {
					wins: 0, losses: 0, draws: 0
				});
			}
			if (!classMatchups.has(reverseClassKey)) {
				classMatchups.set(reverseClassKey, {
					wins: 0, losses: 0, draws: 0
				});
			}

			const classMatchup1 = classMatchups.get(classKey)!;
			const classMatchup2 = classMatchups.get(reverseClassKey)!;

			classMatchup1.wins += p1Wins;
			classMatchup1.losses += p2Wins;
			classMatchup1.draws += draws;

			classMatchup2.wins += p2Wins;
			classMatchup2.losses += p1Wins;
			classMatchup2.draws += draws;

			// Enregistrer les matchups pet vs pet (si les deux ont un pet)
			if (stats1.petTypeId !== null && stats2.petTypeId !== null) {
				const petKey = `${stats1.petTypeId}-${stats2.petTypeId}`;
				const reversePetKey = `${stats2.petTypeId}-${stats1.petTypeId}`;

				if (!petMatchups.has(petKey)) {
					petMatchups.set(petKey, {
						wins: 0, losses: 0, draws: 0
					});
				}
				if (!petMatchups.has(reversePetKey)) {
					petMatchups.set(reversePetKey, {
						wins: 0, losses: 0, draws: 0
					});
				}

				const petMatchup1 = petMatchups.get(petKey)!;
				const petMatchup2 = petMatchups.get(reversePetKey)!;

				petMatchup1.wins += p1Wins;
				petMatchup1.losses += p2Wins;
				petMatchup1.draws += draws;

				petMatchup2.wins += p2Wins;
				petMatchup2.losses += p1Wins;
				petMatchup2.draws += draws;
			}
		}
	}	// 5. Générer le rapport final
	const playerStatsList = Array.from(playerStatsMap.values());

	// Trier par nombre de victoires (descendant)
	playerStatsList.sort((a, b) => b.wins - a.wins);

	let report = `\n\n🏆 **RÉSULTATS DU TOURNOI IA**\n\n`;
	report += `📊 **Statistiques globales :**\n`;
	report += `• Participants : ${eligiblePlayers.length} joueurs\n`;
	report += `• Combats simulés : ${totalFights.toLocaleString()}\n`;
	report += `• Combats par paire : ${fightsPerPair}\n\n`;

	// Top 10 des joueurs
	report += `🥇 **TOP 10 des joueurs :**\n`;
	for (let i = 0; i < Math.min(10, playerStatsList.length); i++) {
		const player = playerStatsList[i];
		const totalMatches = player.wins + player.losses + player.draws;
		const winRate = totalMatches > 0 ? ((player.wins / totalMatches) * 100).toFixed(1) : "0.0";
		const avgDamagePerFight = totalMatches > 0 ? (player.totalDamageDealt / totalMatches).toFixed(1) : "0";
		const avgDamagePerTurn = player.totalTurns > 0 ? (player.totalDamageDealt / player.totalTurns).toFixed(2) : "0";

		report += `${i + 1}. **${player.playerName}** (Niv. ${player.level}) - ${player.className}\n`;
		report += `   📈 ${player.wins}V/${player.losses}D/${player.draws}N (${winRate}% WR)\n`;
		report += `   ⚔️ ${avgDamagePerFight} DPF | ${avgDamagePerTurn} DPT\n`;
		if (player.petName) {
			report += `   🐾 ${player.petName}\n`;
		}
	}

	report += `\n📊 **Statistiques détaillées par joueur :**\n\n`;

	for (const player of playerStatsList) {
		const totalMatches = player.wins + player.losses + player.draws;
		const winRate = totalMatches > 0 ? ((player.wins / totalMatches) * 100).toFixed(1) : "0.0";
		const avgDamagePerFight = totalMatches > 0 ? (player.totalDamageDealt / totalMatches).toFixed(1) : "0";
		const avgDamagePerTurn = player.totalTurns > 0 ? (player.totalDamageDealt / player.totalTurns).toFixed(2) : "0";
		const medianDamagePerTurn = calculateMedian(player.damagePerTurnList).toFixed(2);
		const avgDamageTaken = totalMatches > 0 ? (player.totalDamageTaken / totalMatches).toFixed(1) : "0";

		report += `**${player.playerName}** (Niv. ${player.level})\n`;
		report += `• Classe : ${player.className}\n`;
		report += `• Stats : ⚡ ${player.maxEnergy} PV | ⚔️ ${player.attack} ATK | 🛡️ ${player.defense} DEF | 🚀 ${player.speed} SPD\n`;
		if (player.petName) {
			report += `• Familier : 🐾 ${player.petName}\n`;
		}
		report += `• Résultats : ${player.wins}V / ${player.losses}D / ${player.draws}N (${winRate}% WR)\n`;
		report += `• Dégâts infligés : ${avgDamagePerFight} par combat | ${avgDamagePerTurn} par tour (médiane: ${medianDamagePerTurn})\n`;
		report += `• Dégâts subis : ${avgDamageTaken} par combat\n`;
		report += `• Adversaires battus : ${player.opponentsBeaten.size}/${eligiblePlayers.length - 1}\n\n`;
	}

	// Statistiques de matchups classe vs classe
	report += `\n⚔️ **MATCHUPS CLASSE vs CLASSE :**\n\n`;

	const uniqueClasses = new Set<number>();
	playerStatsList.forEach(p => uniqueClasses.add(p.classId));
	const classesList = Array.from(uniqueClasses).sort((a, b) => a - b);

	for (const classId1 of classesList) {
		for (const classId2 of classesList) {
			if (classId1 >= classId2) {
				continue;
			}

			const key = `${classId1}-${classId2}`;
			const matchup = classMatchups.get(key);

			if (matchup) {
				const total = matchup.wins + matchup.losses + matchup.draws;
				const wr1 = total > 0 ? ((matchup.wins / total) * 100).toFixed(1) : "0";
				const wr2 = total > 0 ? ((matchup.losses / total) * 100).toFixed(1) : "0";

				report += `• **${getClassName(classId1)}** vs **${getClassName(classId2)}**\n`;
				report += `  ${getClassName(classId1)} : ${matchup.wins}V (${wr1}%) | ${getClassName(classId2)} : ${matchup.losses}V (${wr2}%) | Nuls : ${matchup.draws}\n`;
			}
		}
	}

	// Statistiques de matchups pet vs pet
	if (petMatchups.size > 0) {
		report += `\n🐾 **MATCHUPS FAMILIER vs FAMILIER :**\n\n`;

		const uniquePets = new Set<number>();
		playerStatsList.forEach(p => {
			if (p.petTypeId !== null) {
				uniquePets.add(p.petTypeId);
			}
		});
		const petsList = Array.from(uniquePets).sort((a, b) => a - b);

		for (const petId1 of petsList) {
			for (const petId2 of petsList) {
				if (petId1 >= petId2) {
					continue;
				}

				const key = `${petId1}-${petId2}`;
				const matchup = petMatchups.get(key);

				if (matchup) {
					const total = matchup.wins + matchup.losses + matchup.draws;
					const wr1 = total > 0 ? ((matchup.wins / total) * 100).toFixed(1) : "0";
					const wr2 = total > 0 ? ((matchup.losses / total) * 100).toFixed(1) : "0";

					report += `• **${getPetName(petId1)}** vs **${getPetName(petId2)}**\n`;
					report += `  ${getPetName(petId1)} : ${matchup.wins}V (${wr1}%) | ${getPetName(petId2)} : ${matchup.losses}V (${wr2}%) | Nuls : ${matchup.draws}\n`;
				}
			}
		}
	}

	return report;
};

commandInfo.execute = aiTournamentTestCommand;
