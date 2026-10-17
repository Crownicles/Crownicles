import {
	ExecuteTestCommandLike, ITestCommand
} from "../../../../core/CommandsTest";
import Player from "../../../../core/database/game/models/Player";
import { cleanupTournamentFixtures } from "../../../../core/tournaments/TournamentTestUtils";

export const commandInfo: ITestCommand = {
	name: "tournamentcleanup",
	aliases: ["tclean"],
	description: "Supprime les fixtures de tournoi créées par le testeur dans le salon courant"
};

const tournamentCleanupTestCommand: ExecuteTestCommandLike = async (_player: Player, _args, _response, context) => {
	return `${await cleanupTournamentFixtures(context)} fixture(s) tournoi supprimée(s)`;
};

commandInfo.execute = tournamentCleanupTestCommand;
