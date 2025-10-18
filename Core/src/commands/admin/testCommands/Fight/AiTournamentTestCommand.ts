import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import {
	Player
} from "../../../../core/database/game/models/Player";
import {
	InventorySlots
} from "../../../../core/database/game/models/InventorySlot";
import {
	PlayerActiveObjects
} from "../../../../core/database/game/models/PlayerActiveObjects";
import {
	Class,
	ClassDataController
} from "../../../../data/Class";
import { AiPlayerFighter } from "../../../../core/fights/fighter/AiPlayerFighter";
import { FightController } from "../../../../core/fights/FightController";
import { FightOvertimeBehavior } from "../../../../core/fights/FightOvertimeBehavior";
import { FightConstants } from "../../../../../../Lib/src/constants/FightConstants";
import { PetDataController } from "../../../../data/Pet";
import {
	PetEntity,
	PetEntities
} from "../../../../core/database/game/models/PetEntity";
import { Op } from "sequelize";
import { makePacket } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandTestPacketRes } from "../../../../../../Lib/src/packets/commands/CommandTestPacket";
import { PacketUtils } from "../../../../core/utils/PacketUtils";
import { CrowniclesIcons } from "../../../../../../Lib/src/CrowniclesIcons";

/**
 * Get a readable class label from its id
 */
function getClassName(classId: number): string {
	return `Class #${classId}`;
}

function getClassEmoji(classId: number): string {
	return CrowniclesIcons.classes[classId.toString()] || "❔";
}

function formatClassLabel(classId: number): string {
	return `${getClassEmoji(classId)} ${getClassName(classId)}`;
}

function getPetEmoji(petId: number): string {
	return CrowniclesIcons.pets[petId]?.emoteMale || "❔";
}

function formatPetLabel(petId: number): string {
	return `${getPetEmoji(petId)} ${getPetName(petId)}`;
}

function escapeCsvValue(value: string | number): string {
	const stringValue = value === null || value === undefined ? "" : String(value);
	if ((/[",\n\r]/u).test(stringValue)) {
		return `"${stringValue.replace(/"/gu, '""')}"`;
	}
	return stringValue;
}

/**
 * Get a readable pet label from its id
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

interface TournamentFighterResources {
	classData: Class;
	activeObjects: PlayerActiveObjects;
	petEntity: PetEntity | null;
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
	opponentsSeriesWon: Set<number>;
	opponentsSeriesLost: Set<number>;
}

interface PairMatchup {
	entityAId: number;
	entityBId: number;
	entityAWins: number;
	entityBWins: number;
	draws: number;
}

/**
 * Generic function to get or create a matchup entry in a map
 */
function getOrCreateMatchup(
	matchups: Map<string, PairMatchup>,
	entityId1: number,
	entityId2: number
): PairMatchup {
	const entityAId = Math.min(entityId1, entityId2);
	const entityBId = Math.max(entityId1, entityId2);
	const key = `${entityAId}-${entityBId}`;
	let matchup = matchups.get(key);
	if (!matchup) {
		matchup = {
			entityAId,
			entityBId,
			entityAWins: 0,
			entityBWins: 0,
			draws: 0
		};
		matchups.set(key, matchup);
	}
	return matchup;
}

interface ClassPairMatchup extends PairMatchup {
	classAId: number;
	classBId: number;
	classAWins: number;
	classBWins: number;
}

function getOrCreateClassMatchup(
	classMatchups: Map<string, ClassPairMatchup>,
	classId1: number,
	classId2: number
): ClassPairMatchup {
	return getOrCreateMatchup(classMatchups, classId1, classId2) as ClassPairMatchup;
}

interface PetPairMatchup extends PairMatchup {
	petAId: number;
	petBId: number;
	petAWins: number;
	petBWins: number;
}

function getOrCreatePetMatchup(
	petMatchups: Map<string, PetPairMatchup>,
	petId1: number,
	petId2: number
): PetPairMatchup {
	return getOrCreateMatchup(petMatchups, petId1, petId2) as PetPairMatchup;
}

interface MatchupCsvRowInput {
	category: string;
	entityAId: number;
	entityALabel: string;
	entityBId: number;
	entityBLabel: string;
	totalCombats: number;
	draws: number;
	winsA: number;
	winsB: number;
}

export const commandInfo: ITestCommand = {
	name: "aitournament",
	aliases: ["ait", "tournament"],
	commandFormat: "[fightsPerPair:3-10000]",
	typeWaited: {
		fightsPerPair: TypeKey.INTEGER
	},
	description: "Lance un tournoi IA entre tous les joueurs niveau 8+ de la base de données. Paramètre optionnel : fightsPerPair (3-10000, défaut 5000) = nombre de combats par paire."
};

/**
 * Execute an AI tournament
 */
const aiTournamentTestCommand: ExecuteTestCommandLike = async (_player, args, response, context) => {
	const fightsPerPair = args.length > 0 ? Math.min(Math.max(parseInt(args[0], 10), 3), 10000) : 5000;
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
	const fighterResources = new Map<number, TournamentFighterResources>();

	for (const player of eligiblePlayers) {
		const classData = ClassDataController.instance.getById(player.class);
		const activeObjects: PlayerActiveObjects = await InventorySlots.getPlayerActiveObjects(player.id);
		const petEntity = player.petId ? await PetEntities.getById(player.petId) : null;
		const petData = petEntity ? PetDataController.instance.getById(petEntity.typeId) : null;

		fighterResources.set(player.id, {
			classData,
			activeObjects,
			petEntity
		});

		// Créer un fighter temporaire pour obtenir les vraies stats (avec équipements, buffs, etc.)
		const tempFighter = new AiPlayerFighter(
			player,
			classData,
			{
				allowPotionConsumption: false,
				preloadedActiveObjects: activeObjects,
				preloadedPetEntity: petEntity
			}
		);
		await tempFighter.loadStats();

		playerStatsMap.set(player.id, {
			playerId: player.id,
			playerName: `Joueur #${player.id}`,
			level: player.level,
			classId: player.class,
			className: getClassName(player.class),
			petTypeId: petEntity?.typeId || null,
			petName: petData ? getPetName(petData.id) : null,
			maxEnergy: Math.round(tempFighter.getMaxEnergy()), // Vraies PV max avec équipements
			attack: Math.round(tempFighter.getAttack()),
			defense: Math.round(tempFighter.getDefense()),
			speed: Math.round(tempFighter.getSpeed()),
			wins: 0,
			losses: 0,
			draws: 0,
			totalDamageDealt: 0,
			totalDamageTaken: 0,
			totalTurns: 0,
			damagePerTurnList: [],
			opponentsBeaten: new Set(),
			opponentsLostTo: new Set(),
			opponentsSeriesWon: new Set(),
			opponentsSeriesLost: new Set()
		});
	}

	// 3. Statistiques de matchups classe vs classe et pet vs pet
	const classMatchups = new Map<string, ClassPairMatchup>();
	const petMatchups = new Map<string, PetPairMatchup>();

	// 4. Simuler tous les combats
	const totalPairs = (eligiblePlayers.length * (eligiblePlayers.length - 1)) / 2;
	const totalFights = totalPairs * fightsPerPair;

	// Message initial envoyé immédiatement
	PacketUtils.sendPackets(context, [
		makePacket(CommandTestPacketRes, {
			commandName: "aitournament",
			result: `🏆 **Démarrage du tournoi IA**\n\n`
			+ `👥 Participants : ${eligiblePlayers.length} joueurs (niveau ${minLevel}+)\n`
			+ `⚔️ Combats par paire : ${fightsPerPair}\n`
			+ `📊 Total de paires : ${totalPairs}\n`
			+ `🎯 Total de combats : ${totalFights.toLocaleString()}\n\n`
			+ `⏳ Simulation en cours...`,
			isError: false
		})
	]);

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
			const resources1 = fighterResources.get(player1.id)!;
			const resources2 = fighterResources.get(player2.id)!;

			// Statistiques pour cette paire
			let p1Wins = 0;
			let p2Wins = 0;
			let draws = 0;

			// Simuler les combats entre cette paire
			for (let fight = 0; fight < fightsPerPair; fight++) {
				const fighter1 = new AiPlayerFighter(
					player1,
					resources1.classData,
					{
						allowPotionConsumption: false,
						preloadedActiveObjects: resources1.activeObjects,
						preloadedPetEntity: resources1.petEntity
					}
				);
				await fighter1.loadStats();

				const fighter2 = new AiPlayerFighter(
					player2,
					resources2.classData,
					{
						allowPotionConsumption: false,
						preloadedActiveObjects: resources2.activeObjects,
						preloadedPetEntity: resources2.petEntity
					}
				);
				await fighter2.loadStats();

				// Sauvegarder les PV max au DÉBUT du combat (avant buffs/altérations)
				const p1MaxEnergyStart = Math.round(fighter1.getMaxEnergy());
				const p2MaxEnergyStart = Math.round(fighter2.getMaxEnergy());

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
					const winnerFighter = fightResult.getWinnerFighter();
					const isDraw = fightResult.isADraw();

					const p1Energy = Math.round(fighter1.getEnergy());
					const p2Energy = Math.round(fighter2.getEnergy());

					// Dégâts infligés = PV max de l'adversaire (au début) - PV restants de l'adversaire
					const p1Damage = p2MaxEnergyStart - p2Energy; // Joueur 1 inflige des dégâts au joueur 2
					const p2Damage = p1MaxEnergyStart - p1Energy; // Joueur 2 inflige des dégâts au joueur 1

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


					if (isDraw || !winnerFighter) {
						draws++;
						stats1.draws++;
						stats2.draws++;
					}
					else if (winnerFighter === fighter2) {
						p2Wins++;
						stats2.wins++;
						stats1.losses++;
					}
					else if (winnerFighter === fighter1) {
						p1Wins++;
						stats1.wins++;
						stats2.losses++;
					}
					else {
						draws++;
						stats1.draws++;
						stats2.draws++;
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

					// Envoyer message de progression immédiatement
					PacketUtils.sendPackets(context, [
						makePacket(CommandTestPacketRes, {
							commandName: "aitournament",
							result: `⏳ Progression : ${completedFights.toLocaleString()}/${totalFights.toLocaleString()} (${progress}%)\n`
								+ `⚡ Vitesse : ${fightsPerSecond.toFixed(1)} combats/s\n`
								+ `⏱️ Temps restant estimé : ${Math.floor(estimatedTimeRemaining / 60)}m ${estimatedTimeRemaining % 60}s`,
							isError: false
						})
					]);

					lastProgressUpdate = now;
				}
			}

			// Enregistrer les matchups classe vs classe
			const classMatchup = getOrCreateClassMatchup(classMatchups, stats1.classId, stats2.classId);
			classMatchup.draws += draws;
			const isDirectClassOrder = stats1.classId === classMatchup.classAId && stats2.classId === classMatchup.classBId;
			if (isDirectClassOrder) {
				classMatchup.classAWins += p1Wins;
				classMatchup.classBWins += p2Wins;
			}
			else {
				classMatchup.classAWins += p2Wins;
				classMatchup.classBWins += p1Wins;
			}

			if (p1Wins > 0) {
				stats1.opponentsBeaten.add(player2.id);
				stats2.opponentsLostTo.add(player1.id);
			}
			if (p2Wins > 0) {
				stats2.opponentsBeaten.add(player1.id);
				stats1.opponentsLostTo.add(player2.id);
			}
			if (p1Wins > p2Wins) {
				stats1.opponentsSeriesWon.add(player2.id);
				stats2.opponentsSeriesLost.add(player1.id);
			}
			else if (p2Wins > p1Wins) {
				stats2.opponentsSeriesWon.add(player1.id);
				stats1.opponentsSeriesLost.add(player2.id);
			}

			// Enregistrer les matchups pet vs pet (si les deux ont un pet)
			if (stats1.petTypeId !== null && stats2.petTypeId !== null) {
				const petMatchup = getOrCreatePetMatchup(petMatchups, stats1.petTypeId, stats2.petTypeId);
				petMatchup.draws += draws;
				const isDirectPetOrder = stats1.petTypeId === petMatchup.petAId && stats2.petTypeId === petMatchup.petBId;
				if (isDirectPetOrder) {
					petMatchup.petAWins += p1Wins;
					petMatchup.petBWins += p2Wins;
				}
				else {
					petMatchup.petAWins += p2Wins;
					petMatchup.petBWins += p1Wins;
				}
			}
		}
	}	// 5. Générer le rapport final en plusieurs messages
	const playerStatsList = Array.from(playerStatsMap.values());

	// Trier par nombre de victoires (descendant)
	playerStatsList.sort((a, b) => b.wins - a.wins);

	// MESSAGE 1 : En-tête et statistiques globales
	let report1 = `🏆 **RÉSULTATS DU TOURNOI IA**\n\n`;
	report1 += `📊 **Statistiques globales :**\n`;
	report1 += `• Participants : ${eligiblePlayers.length} joueurs\n`;
	report1 += `• Combats simulés : ${totalFights.toLocaleString()}\n`;
	report1 += `• Combats par paire : ${fightsPerPair}\n\n`;

	// Top 10 des joueurs
	report1 += `🥇 **TOP 10 des joueurs :**\n`;
	for (let i = 0; i < Math.min(10, playerStatsList.length); i++) {
		const player = playerStatsList[i];
		const totalMatches = player.wins + player.losses + player.draws;
		const winRate = totalMatches > 0 ? ((player.wins / totalMatches) * 100).toFixed(1) : "0.0";
		const avgDamagePerFight = totalMatches > 0 ? (player.totalDamageDealt / totalMatches).toFixed(1) : "0";
		const avgDamagePerTurn = player.totalTurns > 0 ? (player.totalDamageDealt / player.totalTurns).toFixed(2) : "0";

		report1 += `${i + 1}. **${player.playerName}** (Niv. ${player.level}) - ${player.className}\n`;
		report1 += `   📈 ${player.wins}V/${player.losses}D/${player.draws}N (${winRate}% WR)\n`;
		report1 += `   ⚔️ ${avgDamagePerFight} DPF | ${avgDamagePerTurn} DPT\n`;
		if (player.petName) {
			report1 += `   🐾 ${player.petName}\n`;
		}
	}

	response.push(makePacket(CommandTestPacketRes, {
		commandName: "aitournament",
		result: report1,
		isError: false
	}));

	// MESSAGE 2+ : Statistiques détaillées par joueur (max 3 joueurs par message pour rester sous 4096 caractères)
	const playersPerMessage = 3;
	for (let i = 0; i < playerStatsList.length; i += playersPerMessage) {
		let report = `📊 **Statistiques détaillées (${i + 1}-${Math.min(i + playersPerMessage, playerStatsList.length)}/${playerStatsList.length}) :**\n\n`;

		for (let j = i; j < Math.min(i + playersPerMessage, playerStatsList.length); j++) {
			const player = playerStatsList[j];
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
			const totalOpponents = Math.max(eligiblePlayers.length - 1, 0);
			report += `• Adversaires battus : ${player.opponentsSeriesWon.size} séries | ${player.opponentsBeaten.size} au moins un combat (/${totalOpponents})\n\n`;
		}

		response.push(makePacket(CommandTestPacketRes, {
			commandName: "aitournament",
			result: report,
			isError: false
		}));
	}

	// MESSAGE FINAL : Matchups + export CSV
	const csvRows: string[][] = [
		[
			"category",
			"entity_a_id",
			"entity_a_label",
			"entity_b_id",
			"entity_b_label",
			"total_fights",
			"draws",
			"draw_rate_percent",
			"decisions",
			"decisions_rate_percent",
			"entity_a_wins",
			"entity_a_win_rate_percent",
			"entity_b_wins",
			"entity_b_win_rate_percent"
		]
	];

	const addCsvRow = ({
		category,
		entityAId,
		entityALabel,
		entityBId,
		entityBLabel,
		totalCombats,
		draws,
		winsA,
		winsB
	}: MatchupCsvRowInput): void => {
		const decisions = totalCombats - draws;
		const drawRate = totalCombats > 0 ? (draws / totalCombats) * 100 : 0;
		const decisionsRate = totalCombats > 0 ? (decisions / totalCombats) * 100 : 0;
		const winRateA = totalCombats > 0 ? (winsA / totalCombats) * 100 : 0;
		const winRateB = totalCombats > 0 ? (winsB / totalCombats) * 100 : 0;
		csvRows.push([
			category,
			entityAId.toString(),
			entityALabel,
			entityBId.toString(),
			entityBLabel,
			totalCombats.toString(),
			draws.toString(),
			drawRate.toFixed(2),
			decisions.toString(),
			decisionsRate.toFixed(2),
			winsA.toString(),
			winRateA.toFixed(2),
			winsB.toString(),
			winRateB.toFixed(2)
		]);
	};

	let reportMatchups = `⚔️ **MATCHUPS CLASSE vs CLASSE :**\n\n`;

	const sortedClassMatchups = Array.from(classMatchups.values()).sort((a, b) => {
		if (a.classAId !== b.classAId) {
			return a.classAId - b.classAId;
		}
		return a.classBId - b.classBId;
	});

	if (sortedClassMatchups.length === 0) {
		reportMatchups += "Aucun combat enregistré entre classes.\n";
	}
	else {
		for (const matchup of sortedClassMatchups) {
			const totalCombats = matchup.classAWins + matchup.classBWins + matchup.draws;
			if (totalCombats === 0) {
				continue;
			}

			addCsvRow({
				category: "class",
				entityAId: matchup.classAId,
				entityALabel: formatClassLabel(matchup.classAId),
				entityBId: matchup.classBId,
				entityBLabel: formatClassLabel(matchup.classBId),
				totalCombats,
				draws: matchup.draws,
				winsA: matchup.classAWins,
				winsB: matchup.classBWins
			});

			const drawRate = totalCombats > 0 ? ((matchup.draws / totalCombats) * 100).toFixed(1) : "0.0";
			const classAWinRate = totalCombats > 0 ? ((matchup.classAWins / totalCombats) * 100).toFixed(1) : "0.0";
			const classBWinRate = totalCombats > 0 ? ((matchup.classBWins / totalCombats) * 100).toFixed(1) : "0.0";

			if (matchup.classAId === matchup.classBId) {
				const decisions = matchup.classAWins + matchup.classBWins;
				const decisionsRate = totalCombats > 0 ? ((decisions / totalCombats) * 100).toFixed(1) : "0.0";
				reportMatchups += `• ${formatClassLabel(matchup.classAId)} (miroir) : ${totalCombats.toLocaleString()} combats | ${matchup.draws.toLocaleString()} nuls (${drawRate}%) | décisions : ${decisions.toLocaleString()} (${decisionsRate}%)\n`;
				reportMatchups += `  -> Position A : ${matchup.classAWins.toLocaleString()}V (${classAWinRate}%) | Position B : ${matchup.classBWins.toLocaleString()}V (${classBWinRate}%)\n\n`;
			}
			else {
				reportMatchups += `• ${formatClassLabel(matchup.classAId)} vs ${formatClassLabel(matchup.classBId)} : ${totalCombats.toLocaleString()} combats | ${matchup.draws.toLocaleString()} nuls (${drawRate}%)\n`;
				reportMatchups += `  -> ${formatClassLabel(matchup.classAId)} : ${matchup.classAWins.toLocaleString()}V (${classAWinRate}%) | ${formatClassLabel(matchup.classBId)} : ${matchup.classBWins.toLocaleString()}V (${classBWinRate}%)\n\n`;
			}
		}
	}

	const sortedPetMatchups = Array.from(petMatchups.values()).sort((a, b) => {
		if (a.petAId !== b.petAId) {
			return a.petAId - b.petAId;
		}
		return a.petBId - b.petBId;
	});

	if (sortedPetMatchups.length > 0) {
		reportMatchups += `\n🐾 **MATCHUPS FAMILIER vs FAMILIER :**\n\n`;
		for (const matchup of sortedPetMatchups) {
			const totalCombats = matchup.petAWins + matchup.petBWins + matchup.draws;
			if (totalCombats === 0) {
				continue;
			}

			addCsvRow({
				category: "pet",
				entityAId: matchup.petAId,
				entityALabel: formatPetLabel(matchup.petAId),
				entityBId: matchup.petBId,
				entityBLabel: formatPetLabel(matchup.petBId),
				totalCombats,
				draws: matchup.draws,
				winsA: matchup.petAWins,
				winsB: matchup.petBWins
			});

			const drawRate = totalCombats > 0 ? ((matchup.draws / totalCombats) * 100).toFixed(1) : "0.0";
			const petAWinRate = totalCombats > 0 ? ((matchup.petAWins / totalCombats) * 100).toFixed(1) : "0.0";
			const petBWinRate = totalCombats > 0 ? ((matchup.petBWins / totalCombats) * 100).toFixed(1) : "0.0";

			if (matchup.petAId === matchup.petBId) {
				const decisions = matchup.petAWins + matchup.petBWins;
				const decisionsRate = totalCombats > 0 ? ((decisions / totalCombats) * 100).toFixed(1) : "0.0";
				reportMatchups += `• ${formatPetLabel(matchup.petAId)} (miroir) : ${totalCombats.toLocaleString()} combats | ${matchup.draws.toLocaleString()} nuls (${drawRate}%) | décisions : ${decisions.toLocaleString()} (${decisionsRate}%)\n`;
				reportMatchups += `  -> Position A : ${matchup.petAWins.toLocaleString()}V (${petAWinRate}%) | Position B : ${matchup.petBWins.toLocaleString()}V (${petBWinRate}%)\n\n`;
			}
			else {
				reportMatchups += `• ${formatPetLabel(matchup.petAId)} vs ${formatPetLabel(matchup.petBId)} : ${totalCombats.toLocaleString()} combats | ${matchup.draws.toLocaleString()} nuls (${drawRate}%)\n`;
				reportMatchups += `  -> ${formatPetLabel(matchup.petAId)} : ${matchup.petAWins.toLocaleString()}V (${petAWinRate}%) | ${formatPetLabel(matchup.petBId)} : ${matchup.petBWins.toLocaleString()}V (${petBWinRate}%)\n\n`;
			}
		}
	}

	response.push(makePacket(CommandTestPacketRes, {
		commandName: "aitournament",
		result: reportMatchups,
		isError: false
	}));

	if (csvRows.length > 1) {
		const csvContent = csvRows.map(row => row.map(escapeCsvValue).join(",")).join("\n");
		const csvFileName = `ai_tournament_matchups_${new Date()
			.toISOString()
			.replace(/[:.]/gu, "-")}.csv`;
		response.push(makePacket(CommandTestPacketRes, {
			commandName: "aitournament",
			result: `📄 Export CSV généré : ${csvFileName}`,
			isError: false,
			fileName: csvFileName,
			fileContentBase64: Buffer.from(csvContent, "utf8").toString("base64")
		}));
	}

	return "✅ Tournoi terminé ! Consultez les résultats ci-dessus.";
};

commandInfo.execute = aiTournamentTestCommand;
