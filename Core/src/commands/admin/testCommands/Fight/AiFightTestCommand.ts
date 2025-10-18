import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { Players } from "../../../../core/database/game/models/Player";
import { ClassDataController } from "../../../../data/Class";
import { AiPlayerFighter } from "../../../../core/fights/fighter/AiPlayerFighter";
import { FightController } from "../../../../core/fights/FightController";
import { FightOvertimeBehavior } from "../../../../core/fights/FightOvertimeBehavior";
import { makePacket } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandTestPacketRes } from "../../../../../../Lib/src/packets/commands/CommandTestPacket";
import { FightConstants } from "../../../../../../Lib/src/constants/FightConstants";
import { PlayerFighter } from "../../../../core/fights/fighter/PlayerFighter";

export const commandInfo: ITestCommand = {
	name: "aifight",
	aliases: ["aif", "aivs"],
	commandFormat: "<player1Id> <player2Id>",
	typeWaited: {
		player1Id: TypeKey.INTEGER,
		player2Id: TypeKey.INTEGER
	},
	description: "Lance un combat entre deux joueurs contrôlés par l'IA. Les deux joueurs doivent exister et avoir au moins le niveau requis pour combattre. Les IDs sont les IDs de la table Player (nombres)."
};

/**
 * Execute an AI vs AI fight
 */
const aiFightTestCommand: ExecuteTestCommandLike = async (_player, args, response, context) => {
	const player1Id = parseInt(args[0], 10);
	const player2Id = parseInt(args[1], 10);

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

	/*
	 * 3. Créer les combattants IA
	 * On utilise PlayerFighter pour le premier joueur car FightController attend que fighter1 soit un PlayerFighter
	 */
	const fighter1 = new PlayerFighter(
		player1,
		ClassDataController.instance.getById(player1.class)
	);
	await fighter1.loadStats();

	const fighter2 = new AiPlayerFighter(
		player2,
		ClassDataController.instance.getById(player2.class)
	);
	await fighter2.loadStats();

	// 4. Créer le contrôleur de combat
	const fightController = new FightController(
		{
			fighter1: fighter1,
			fighter2: fighter2
		},
		FightOvertimeBehavior.END_FIGHT_DRAW, // Match nul après MAX_TURNS
		context
	);

	// 5. Définir un callback personnalisé pour la fin du combat
	fightController.setEndCallback((fight, endResponse) => {
		const winner = fight.getWinner(); // 0 ou 1
		const isDraw = fight.isADraw();

		let resultMessage = "";
		if (isDraw) {
			resultMessage = `⚔️ Match nul entre Joueur ${player1.id} et Joueur ${player2.id} !`;
		}
		else {
			const winnerPlayer = winner === 0 ? player1 : player2;
			const loserPlayer = winner === 0 ? player2 : player1;
			resultMessage = `🏆 Joueur ${winnerPlayer.id} a vaincu Joueur ${loserPlayer.id} !`;
		}

		resultMessage += `\n\n**Statistiques finales :**`;
		resultMessage += `\nJoueur ${player1.id} : ${Math.round(fighter1.getEnergy())}/${fighter1.getMaxEnergy()} PV`;
		resultMessage += `\nJoueur ${player2.id} : ${Math.round(fighter2.getEnergy())}/${fighter2.getMaxEnergy()} PV`;
		resultMessage += `\n\nNombre de tours : ${fight.turn}`;

		endResponse.push(makePacket(CommandTestPacketRes, {
			commandName: "aifight",
			result: resultMessage,
			isError: false
		}));

		return Promise.resolve();
	});

	// 6. Lancer le combat
	await fightController.startFight(response);

	// 7. Message de début
	return `⚔️ Combat lancé entre Joueur ${player1.id} et Joueur ${player2.id} !\n\nLe combat se déroule...`;
};

commandInfo.execute = aiFightTestCommand;
