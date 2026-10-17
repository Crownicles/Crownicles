import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import Player from "../../../../core/database/game/models/Player";
import {
	createTournamentFixture, forceTournamentPhase, type TournamentTestPhase
} from "../../../../core/tournaments/TournamentTestUtils";
import { getCategoryCounts } from "../../../../core/tournaments/TournamentRules";
import { TournamentCategories } from "../../../../../../Lib/src/types/Tournament";

export const commandInfo: ITestCommand = {
	name: "tournamentsetup",
	aliases: ["tsetup"],
	commandFormat: "[phase]",
	typeWaited: { phase: TypeKey.STRING },
	minArgs: 0,
	description: "Crée une fixture complète de tournoi avec 20 joueurs, 10 par catégorie. Phase optionnelle : registration, combat ou paused"
};

const tournamentSetupTestCommand: ExecuteTestCommandLike = async (player: Player, args, _response, context) => {
	const fixture = await createTournamentFixture(context, player);
	const phase = args[0] as TournamentTestPhase | undefined;
	if (phase && phase !== "registration") {
		await forceTournamentPhase(context, phase);
	}
	const counts = getCategoryCounts(fixture.participants);
	return `Fixture tournoi ${fixture.tournament.id} prête : ${fixture.participants.length} participants (niveau 50 : ${counts[TournamentCategories.LEVEL_50]}, niveau 100 : ${counts[TournamentCategories.LEVEL_100]}), phase=${phase ?? "registration"}`;
};

commandInfo.execute = tournamentSetupTestCommand;
