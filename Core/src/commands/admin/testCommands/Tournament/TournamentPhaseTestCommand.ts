import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import Player from "../../../../core/database/game/models/Player";
import {
	forceTournamentPhase, type TournamentTestPhase
} from "../../../../core/tournaments/TournamentTestUtils";

export const commandInfo: ITestCommand = {
	name: "tournamentphase",
	aliases: ["tphase"],
	commandFormat: "<phase>",
	typeWaited: { phase: TypeKey.STRING },
	description: "Force la phase de la fixture courante : registration, combat, paused, resume, completed ou cancelled"
};

const tournamentPhaseTestCommand: ExecuteTestCommandLike = async (_player: Player, args, _response, context) => {
	const phase = args[0] as TournamentTestPhase;
	const fixture = await forceTournamentPhase(context, phase);
	return `Tournoi ${fixture.tournament.id} : phase=${fixture.tournament.status}`;
};

commandInfo.execute = tournamentPhaseTestCommand;
