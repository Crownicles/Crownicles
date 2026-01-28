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
import {
	PetEntity,
	PetEntities
} from "../../../../core/database/game/models/PetEntity";
import { Op } from "sequelize";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandTestPacketRes } from "../../../../../../Lib/src/packets/commands/CommandTestPacket";
import { CrowniclesLogger } from "../../../../../../Lib/src/logs/CrowniclesLogger";
import {
	existsSync, mkdirSync, writeFileSync
} from "fs";
import { join } from "path";

/**
 * Escape a value for CSV export by wrapping it in quotes if it contains special characters
 * @param value - The value to escape
 * @returns The escaped value
 */
function escapeCsvValue(value: string | number): string {
	const stringValue = value === null || value === undefined ? "" : String(value);
	if ((/[",\n\r]/u).test(stringValue)) {
		return `"${stringValue.replace(/"/gu, '""')}"`;
	}
	return stringValue;
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
 * Generate a report for the top 10 players
 */
function generateTop10Report(
	playerStatsList: PlayerStats[],
	_eligiblePlayers: Player[],
	_totalFights: number,
	_fightsPerPair: number
): string {
	let report = "🥇 **TOP 10 des joueurs :**\n";
	for (let i = 0; i < Math.min(10, playerStatsList.length); i++) {
		const player = playerStatsList[i];
		const totalMatches = player.wins + player.losses + player.draws;
		const winRate = totalMatches > 0 ? ((player.wins / totalMatches) * 100).toFixed(1) : "0.0";
		const avgDamagePerFight = totalMatches > 0 ? (player.totalDamageDealt / totalMatches).toFixed(1) : "0";
		const avgDamagePerTurn = player.totalTurns > 0 ? (player.totalDamageDealt / player.totalTurns).toFixed(2) : "0";
		const petLabel = player.petTypeId !== null ? `Pet ${player.petTypeId}` : null;

		report += `${i + 1}. **${player.playerName}** (Niv. ${player.level}) - Classe ${player.classId}\n`;
		report += `   📈 ${player.wins}V/${player.losses}D/${player.draws}N (${winRate}% WR)\n`;
		report += `   ⚔️ ${avgDamagePerFight} DPF | ${avgDamagePerTurn} DPT\n`;
		if (petLabel) {
			report += `   🐾 ${petLabel}\n`;
		}
	}

	return report;
}

/**
 * Generate detailed player stats reports (paginated)
 */
function generateDetailedStatsReports(
	playerStatsList: PlayerStats[],
	eligiblePlayers: Player[]
): string[] {
	const reports: string[] = [];
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
			report += `• Classe : ${player.classId}\n`;
			report += `• Stats : ⚡ ${player.maxEnergy} PV | ⚔️ ${player.attack} ATK | 🛡️ ${player.defense} DEF | 🚀 ${player.speed} SPD\n`;
			if (player.petTypeId !== null) {
				report += `• Familier : 🐾 Pet ${player.petTypeId}\n`;
			}
			report += `• Résultats : ${player.wins}V / ${player.losses}D / ${player.draws}N (${winRate}% WR)\n`;
			report += `• Dégâts infligés : ${avgDamagePerFight} par combat | ${avgDamagePerTurn} par tour (médiane: ${medianDamagePerTurn})\n`;
			report += `• Dégâts subis : ${avgDamageTaken} par combat\n`;
			const totalOpponents = Math.max(eligiblePlayers.length - 1, 0);
			report += `• Adversaires battus : ${player.opponentsSeriesWon.size} séries | ${player.opponentsBeaten.size} au moins un combat (/${totalOpponents})\n\n`;
		}

		reports.push(report);
	}

	return reports;
}

/**
 * Generate matchup reports for classes and pets
 */
function generateMatchupReports(
	classMatchups: Map<string, ClassPairMatchup>,
	petMatchups: Map<string, PetPairMatchup>,
	addCsvRow: (input: MatchupCsvRowInput) => void
): string {
	let reportMatchups = "⚔️ **MATCHUPS CLASSE vs CLASSE :**\n\n";

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
				entityALabel: matchup.classAId.toString(),
				entityBId: matchup.classBId,
				entityBLabel: matchup.classBId.toString(),
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
				reportMatchups += `• Classe ${matchup.classAId} (miroir) : ${totalCombats.toLocaleString()} combats | ${matchup.draws.toLocaleString()} nuls (${drawRate}%) | décisions : ${decisions.toLocaleString()} (${decisionsRate}%)\n`;
				reportMatchups += `  -> Position A : ${matchup.classAWins.toLocaleString()}V (${classAWinRate}%) | Position B : ${matchup.classBWins.toLocaleString()}V (${classBWinRate}%)\n\n`;
			}
			else {
				reportMatchups += `• Classe ${matchup.classAId} vs Classe ${matchup.classBId} : ${totalCombats.toLocaleString()} combats | ${matchup.draws.toLocaleString()} nuls (${drawRate}%)\n`;
				reportMatchups += `  -> Classe ${matchup.classAId} : ${matchup.classAWins.toLocaleString()}V (${classAWinRate}%) | Classe ${matchup.classBId} : ${matchup.classBWins.toLocaleString()}V (${classBWinRate}%)\n\n`;
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
		reportMatchups += "\n🐾 **MATCHUPS FAMILIER vs FAMILIER :**\n\n";
		for (const matchup of sortedPetMatchups) {
			const totalCombats = matchup.petAWins + matchup.petBWins + matchup.draws;
			if (totalCombats === 0) {
				continue;
			}

			addCsvRow({
				category: "pet",
				entityAId: matchup.petAId,
				entityALabel: matchup.petAId.toString(),
				entityBId: matchup.petBId,
				entityBLabel: matchup.petBId.toString(),
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
				reportMatchups += `• Pet ${matchup.petAId} (miroir) : ${totalCombats.toLocaleString()} combats | ${matchup.draws.toLocaleString()} nuls (${drawRate}%) | décisions : ${decisions.toLocaleString()} (${decisionsRate}%)\n`;
				reportMatchups += `  -> Position A : ${matchup.petAWins.toLocaleString()}V (${petAWinRate}%) | Position B : ${matchup.petBWins.toLocaleString()}V (${petBWinRate}%)\n\n`;
			}
			else {
				reportMatchups += `• Pet ${matchup.petAId} vs Pet ${matchup.petBId} : ${totalCombats.toLocaleString()} combats | ${matchup.draws.toLocaleString()} nuls (${drawRate}%)\n`;
				reportMatchups += `  -> Pet ${matchup.petAId} : ${matchup.petAWins.toLocaleString()}V (${petAWinRate}%) | Pet ${matchup.petBId} : ${matchup.petBWins.toLocaleString()}V (${petBWinRate}%)\n\n`;
			}
		}
	}

	return reportMatchups;
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
	petTypeId: number | null;
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

interface ClassPairMatchup extends PairMatchup {
	classAId: number;
	classBId: number;
	classAWins: number;
	classBWins: number;
}

/**
 * Generic function to get or create a matchup entry for tracking wins/losses between two entities
 * @param matchups - Map of matchups
 * @param id1 - First entity ID
 * @param id2 - Second entity ID
 * @param createMatchup - Factory function to create a new matchup object
 * @returns The matchup object
 */
function getOrCreateMatchup<T extends PairMatchup>(
	matchups: Map<string, T>,
	id1: number,
	id2: number,
	createMatchup: (entityAId: number, entityBId: number) => T
): T {
	const entityAId = Math.min(id1, id2);
	const entityBId = Math.max(id1, id2);
	const key = `${entityAId}-${entityBId}`;

	let matchup = matchups.get(key);
	if (!matchup) {
		matchup = createMatchup(entityAId, entityBId);
		matchups.set(key, matchup);
	}
	return matchup;
}

interface PetPairMatchup extends PairMatchup {
	petAId: number;
	petBId: number;
	petAWins: number;
	petBWins: number;
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
	commandFormat: "[fightsPerPair:3-10000] [showDetails:true/false]",
	typeWaited: {
		fightsPerPair: TypeKey.INTEGER,
		showDetails: TypeKey.STRING
	},
	minArgs: 0, // Both parameters are optional
	description: "Lance un tournoi IA entre tous les joueurs niveau 8+ de la base de données. Paramètres optionnels : fightsPerPair (3-10000, défaut 5000), showDetails (true/false, défaut false)."
};

/**
 * Execute an AI tournament
 */
const aiTournamentTestCommand: ExecuteTestCommandLike = async (_player, args, response, context) => {
	const fightsPerPair = args.length > 0 ? Math.min(Math.max(parseInt(args[0], 10), 3), 10000) : 5000;
	const showDetails = args.length > 1 ? args[1].toLowerCase() === "true" : false;
	const minLevel = FightConstants.REQUIRED_LEVEL;

	// 1. Récupérer tous les joueurs éligibles (niveau 8+)
	const allPlayers = await Player.findAll({
		where: {
			level: { [Op.gte]: minLevel }
		}
	});

	// Filtrer les joueurs qui peuvent combattre
	const eligiblePlayers = allPlayers.filter((p: Player) => p.level >= FightConstants.REQUIRED_LEVEL);

	if (eligiblePlayers.length < 2) {
		return `❌ Pas assez de joueurs éligibles pour un tournoi (minimum 2 requis, ${eligiblePlayers.length} trouvé(s) avec niveau ${minLevel}+).`;
	}

	// 2. Calculer les totaux et envoyer la réponse immédiate
	const totalPairs = (eligiblePlayers.length * (eligiblePlayers.length - 1)) / 2;
	const totalFights = totalPairs * fightsPerPair;

	// Réponse immédiate à l'interaction Discord
	response.push(makePacket(CommandTestPacketRes, {
		commandName: "aitournament",
		result: "🏆 **Tournoi IA lancé !**\n\n"
			+ `👥 Participants : ${eligiblePlayers.length} joueurs (niveau ${minLevel}+)\n`
			+ `⚔️ Combats par paire : ${fightsPerPair}\n`
			+ `📊 Total de paires : ${totalPairs}\n`
			+ `🎯 Total de combats : ${totalFights.toLocaleString()}\n\n`
			+ "Les résultats seront sauvegardés dans le dossier `tournament_results/`",
		isError: false
	}));

	// Lancer le tournoi en arrière-plan
	runTournamentInBackground({
		eligiblePlayers,
		fightsPerPair,
		showDetails,
		minLevel,
		totalPairs,
		totalFights,
		context,
		response
	}).catch(error => {
		CrowniclesLogger.error(`Erreur lors de l'exécution du tournoi : ${error}`);
	});

	return "";
};

/**
 * Initialize player stats for the tournament
 */
async function initializePlayerStats(
	eligiblePlayers: Player[],
	playerStatsMap: Map<number, PlayerStats>,
	fighterResources: Map<number, TournamentFighterResources>
): Promise<void> {
	for (const player of eligiblePlayers) {
		const classData = ClassDataController.instance.getById(player.class)!;
		const activeObjects: PlayerActiveObjects = await InventorySlots.getPlayerActiveObjects(player.id);
		const petEntity = player.petId ? await PetEntities.getById(player.petId) : null;

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
			petTypeId: petEntity?.typeId ?? null,
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
}

/**
 * Represents the summary of a fight result for tournament statistics.
 */
type FightResultSummary = {
	turn: number;
	getWinnerFighter: () => unknown;
	isADraw: () => boolean;
};

/**
 * Update fight statistics after a fight
 */
function updateFightStats(params: {
	fightResult: FightResultSummary;
	fighter1: AiPlayerFighter;
	fighter2: AiPlayerFighter;
	p1MaxEnergyStart: number;
	p2MaxEnergyStart: number;
	stats1: PlayerStats;
	stats2: PlayerStats;
}): {
	p1Wins: number; p2Wins: number; draws: number;
} {
	const {
		fightResult, fighter1, fighter2, p1MaxEnergyStart, p2MaxEnergyStart, stats1, stats2
	} = params;

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

	let p1Wins = 0;
	let p2Wins = 0;
	let draws = 0;

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

	return {
		p1Wins, p2Wins, draws
	};
}

/**
 * Update matchup statistics
 */
function updateMatchupStats(params: {
	player1: Player;
	player2: Player;
	stats1: PlayerStats;
	stats2: PlayerStats;
	p1Wins: number;
	p2Wins: number;
	draws: number;
	classMatchups: Map<string, ClassPairMatchup>;
	petMatchups: Map<string, PetPairMatchup>;
}): void {
	const {
		player1, player2, stats1, stats2, p1Wins, p2Wins, draws, classMatchups, petMatchups
	} = params;

	// Enregistrer les matchups classe vs classe
	const classMatchup = getOrCreateMatchup(classMatchups, stats1.classId, stats2.classId, (classAId, classBId) => ({
		entityAId: classAId,
		entityBId: classBId,
		classAId,
		classBId,
		entityAWins: 0,
		entityBWins: 0,
		classAWins: 0,
		classBWins: 0,
		draws: 0
	}));
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
		const petMatchup = getOrCreateMatchup(petMatchups, stats1.petTypeId, stats2.petTypeId, (petAId, petBId) => ({
			entityAId: petAId,
			entityBId: petBId,
			petAId,
			petBId,
			entityAWins: 0,
			entityBWins: 0,
			petAWins: 0,
			petBWins: 0,
			draws: 0
		}));
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

/**
 * Create and load a fighter for tournament simulation
 */
async function createTournamentFighter(
	player: Player,
	resources: TournamentFighterResources
): Promise<AiPlayerFighter> {
	const fighter = new AiPlayerFighter(
		player,
		resources.classData,
		{
			allowPotionConsumption: false,
			preloadedActiveObjects: resources.activeObjects,
			preloadedPetEntity: resources.petEntity
		}
	);
	await fighter.loadStats();
	return fighter;
}

/**
 * Execute a single fight and collect statistics
 */
async function executeSingleFight(params: {
	fighter1: AiPlayerFighter;
	fighter2: AiPlayerFighter;
	stats1: PlayerStats;
	stats2: PlayerStats;
	context: PacketContext;
	response: CrowniclesPacket[];
}): Promise<{
	p1Wins: number; p2Wins: number; draws: number;
}> {
	const {
		fighter1, fighter2, stats1, stats2, context, response
	} = params;

	// Sauvegarder les PV max au DÉBUT du combat (avant buffs/altérations)
	const p1MaxEnergyStart = Math.round(fighter1.getMaxEnergy());
	const p2MaxEnergyStart = Math.round(fighter2.getMaxEnergy());

	const fightController = new FightController(
		{
			fighter1,
			fighter2
		},
		FightOvertimeBehavior.END_FIGHT_DRAW,
		context,
		true // Silent mode
	);

	let result = {
		p1Wins: 0, p2Wins: 0, draws: 0
	};

	// Définir un callback pour collecter les statistiques
	fightController.setEndCallback(fightResult => {
		result = updateFightStats({
			fightResult,
			fighter1,
			fighter2,
			p1MaxEnergyStart,
			p2MaxEnergyStart,
			stats1,
			stats2
		});

		return Promise.resolve();
	});

	await fightController.startFight(response);

	return result;
}

/**
 * Simulate fights between two players
 */
async function simulateFightsBetweenPlayers(params: {
	player1: Player;
	player2: Player;
	stats1: PlayerStats;
	stats2: PlayerStats;
	resources1: TournamentFighterResources;
	resources2: TournamentFighterResources;
	fightsPerPair: number;
	context: PacketContext;
	response: CrowniclesPacket[];
}): Promise<{
	p1Wins: number; p2Wins: number; draws: number;
}> {
	const {
		player1, player2, stats1, stats2, resources1, resources2, fightsPerPair, context, response
	} = params;
	let p1Wins = 0;
	let p2Wins = 0;
	let draws = 0;

	// Simuler les combats entre cette paire
	for (let fight = 0; fight < fightsPerPair; fight++) {
		const fighter1 = await createTournamentFighter(player1, resources1);
		const fighter2 = await createTournamentFighter(player2, resources2);

		const result = await executeSingleFight({
			fighter1,
			fighter2,
			stats1,
			stats2,
			context,
			response
		});

		p1Wins += result.p1Wins;
		p2Wins += result.p2Wins;
		draws += result.draws;
	}

	return {
		p1Wins, p2Wins, draws
	};
}

/**
 * Log tournament progress
 */
function logTournamentProgress(
	completedFights: number,
	totalFights: number,
	startTime: number,
	now: number
): void {
	const progress = (completedFights / totalFights * 100).toFixed(1);
	const fightsPerSecond = completedFights / ((now - startTime) / 1000);
	const estimatedTimeRemaining = Math.ceil((totalFights - completedFights) / fightsPerSecond);

	CrowniclesLogger.info(
		`⏳ Progression : ${completedFights.toLocaleString()}/${totalFights.toLocaleString()} (${progress}%) | `
		+ `⚡ ${fightsPerSecond.toFixed(1)} combats/s | `
		+ `⏱️ Temps restant : ${Math.floor(estimatedTimeRemaining / 60)}m ${estimatedTimeRemaining % 60}s`
	);
}

/**
 * Generate and save tournament reports
 */
function generateAndSaveReports(params: {
	playerStatsMap: Map<number, PlayerStats>;
	eligiblePlayers: Player[];
	totalFights: number;
	fightsPerPair: number;
	showDetails: boolean;
	classMatchups: Map<string, ClassPairMatchup>;
	petMatchups: Map<string, PetPairMatchup>;
	startTime: number;
	endTime: number;
}): void {
	const {
		playerStatsMap,
		eligiblePlayers,
		totalFights,
		fightsPerPair,
		showDetails,
		classMatchups,
		petMatchups,
		startTime,
		endTime
	} = params;
	const actualDuration = Math.floor((endTime - startTime) / 1000);
	const actualMinutes = Math.floor(actualDuration / 60);
	const actualSeconds = actualDuration % 60;

	const playerStatsList = Array.from(playerStatsMap.values());
	playerStatsList.sort((a, b) => b.wins - a.wins);

	// Générer le rapport texte complet
	let fullReport = "🏆 **RÉSULTATS DU TOURNOI IA**\n\n";
	fullReport += "📊 **Statistiques globales :**\n";
	fullReport += `• Participants : ${eligiblePlayers.length} joueurs\n`;
	fullReport += `• Combats simulés : ${totalFights.toLocaleString()}\n`;
	fullReport += `• Combats par paire : ${fightsPerPair}\n`;
	fullReport += `• Durée réelle : ${actualMinutes}m ${actualSeconds}s\n\n`;

	// Top 10
	fullReport += generateTop10Report(playerStatsList, eligiblePlayers, totalFights, fightsPerPair);

	// Statistiques détaillées si demandé
	if (showDetails) {
		fullReport += "\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
		const detailedReports = generateDetailedStatsReports(playerStatsList, eligiblePlayers);
		fullReport += detailedReports.join("\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n");
	}

	// Matchups
	fullReport += "\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";

	// Générer CSV
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

	fullReport += generateMatchupReports(classMatchups, petMatchups, addCsvRow);

	// 7. Sauvegarder les fichiers localement
	const timestamp = new Date()
		.toISOString()
		.replace(/[:.]/gu, "-");
	const outputDir = join(process.cwd(), "tournament_results");

	// Créer le dossier s'il n'existe pas
	if (!existsSync(outputDir)) {
		mkdirSync(outputDir, { recursive: true });
	}

	const txtFileName = `ai_tournament_${timestamp}.txt`;
	const csvFileName = `ai_tournament_matchups_${timestamp}.csv`;
	const txtFilePath = join(outputDir, txtFileName);
	const csvFilePath = join(outputDir, csvFileName);

	// Sauvegarder le rapport texte
	writeFileSync(txtFilePath, fullReport, "utf8");
	CrowniclesLogger.info(`📄 Rapport texte sauvegardé : ${txtFilePath}`);

	// Sauvegarder le CSV
	const csvContent = csvRows.map(row => row.map(escapeCsvValue).join(",")).join("\n");
	writeFileSync(csvFilePath, csvContent, "utf8");
	CrowniclesLogger.info(`📊 Fichier CSV sauvegardé : ${csvFilePath}`);
}

/**
 * Log tournament start information
 */
function logTournamentStart(params: {
	eligiblePlayersCount: number;
	minLevel: number;
	fightsPerPair: number;
	totalPairs: number;
	totalFights: number;
}): void {
	const {
		eligiblePlayersCount, minLevel, fightsPerPair, totalPairs, totalFights
	} = params;

	CrowniclesLogger.info("🏆 **DÉMARRAGE DU TOURNOI IA**");
	CrowniclesLogger.info(`👥 Participants : ${eligiblePlayersCount} joueurs (niveau ${minLevel}+)`);
	CrowniclesLogger.info(`⚔️ Combats par paire : ${fightsPerPair}`);
	CrowniclesLogger.info(`📊 Total de paires : ${totalPairs}`);
	CrowniclesLogger.info(`🎯 Total de combats : ${totalFights.toLocaleString()}`);
	CrowniclesLogger.info("⏳ Simulation en cours...\n");
}

/**
 * Process all tournament matchups
 */
async function processAllMatchups(params: {
	eligiblePlayers: Player[];
	playerStatsMap: Map<number, PlayerStats>;
	fighterResources: Map<number, TournamentFighterResources>;
	fightsPerPair: number;
	classMatchups: Map<string, ClassPairMatchup>;
	petMatchups: Map<string, PetPairMatchup>;
	totalFights: number;
	context: PacketContext;
	response: CrowniclesPacket[];
}): Promise<void> {
	const {
		eligiblePlayers,
		playerStatsMap,
		fighterResources,
		fightsPerPair,
		classMatchups,
		petMatchups,
		totalFights,
		context,
		response
	} = params;

	const startTime = Date.now();
	let completedFights = 0;
	let lastProgressUpdate = Date.now();
	const progressUpdateIntervalMs = 5000;

	for (let i = 0; i < eligiblePlayers.length; i++) {
		for (let j = i + 1; j < eligiblePlayers.length; j++) {
			const player1 = eligiblePlayers[i];
			const player2 = eligiblePlayers[j];
			const stats1 = playerStatsMap.get(player1.id)!;
			const stats2 = playerStatsMap.get(player2.id)!;
			const resources1 = fighterResources.get(player1.id)!;
			const resources2 = fighterResources.get(player2.id)!;

			const {
				p1Wins, p2Wins, draws
			} = await simulateFightsBetweenPlayers({
				player1,
				player2,
				stats1,
				stats2,
				resources1,
				resources2,
				fightsPerPair,
				context,
				response
			});

			completedFights += fightsPerPair;

			const now = Date.now();
			if (now - lastProgressUpdate >= progressUpdateIntervalMs) {
				logTournamentProgress(completedFights, totalFights, startTime, now);
				lastProgressUpdate = now;
			}

			updateMatchupStats({
				player1,
				player2,
				stats1,
				stats2,
				p1Wins,
				p2Wins,
				draws,
				classMatchups,
				petMatchups
			});
		}
	}
}

/**
 * Execute the tournament in background
 */
async function runTournamentInBackground(params: {
	eligiblePlayers: Player[];
	fightsPerPair: number;
	showDetails: boolean;
	minLevel: number;
	totalPairs: number;
	totalFights: number;
	context: PacketContext;
	response: CrowniclesPacket[];
}): Promise<void> {
	const {
		eligiblePlayers, fightsPerPair, showDetails, minLevel, totalPairs, totalFights, context, response
	} = params;

	logTournamentStart({
		eligiblePlayersCount: eligiblePlayers.length,
		minLevel,
		fightsPerPair,
		totalPairs,
		totalFights
	});

	const playerStatsMap = new Map<number, PlayerStats>();
	const fighterResources = new Map<number, TournamentFighterResources>();
	await initializePlayerStats(eligiblePlayers, playerStatsMap, fighterResources);

	const classMatchups = new Map<string, ClassPairMatchup>();
	const petMatchups = new Map<string, PetPairMatchup>();

	const startTime = Date.now();
	await processAllMatchups({
		eligiblePlayers,
		playerStatsMap,
		fighterResources,
		fightsPerPair,
		classMatchups,
		petMatchups,
		totalFights,
		context,
		response
	});

	const endTime = Date.now();
	generateAndSaveReports({
		playerStatsMap,
		eligiblePlayers,
		totalFights,
		fightsPerPair,
		showDetails,
		classMatchups,
		petMatchups,
		startTime,
		endTime
	});

	CrowniclesLogger.info("\n✅ Tournoi terminé avec succès !\n");
}

commandInfo.execute = aiTournamentTestCommand;
