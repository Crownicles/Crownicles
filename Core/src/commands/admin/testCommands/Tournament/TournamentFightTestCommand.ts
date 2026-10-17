import {
	ExecuteTestCommandLike, ITestCommand
} from "../../../../core/CommandsTest";
import Player from "../../../../core/database/game/models/Player";
import { runTournamentTestFight } from "../../../../core/tournaments/TournamentTestUtils";

export const commandInfo: ITestCommand = {
	name: "tournamentfight",
	description: "Simule une fight tournoi contre un joueur de la même catégorie et vérifie l'idempotence"
};

const tournamentFightTestCommand: ExecuteTestCommandLike = async (player: Player, _args, _response, context) => {
	return await runTournamentTestFight(context, player);
};

commandInfo.execute = tournamentFightTestCommand;
