import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import Player from "../../../../core/database/game/models/Player";
import {
	claimTournamentFixture, finishTournamentFixture, type TournamentTestRewardAction
} from "../../../../core/tournaments/TournamentTestUtils";

export const commandInfo: ITestCommand = {
	name: "tournamentreward",
	aliases: ["treward"],
	commandFormat: "<action>",
	typeWaited: { action: TypeKey.STRING },
	description: "Teste les récompenses : finish, claim, claimall ou retry"
};

const tournamentRewardTestCommand: ExecuteTestCommandLike = async (player: Player, args, _response, context) => {
	const action = args[0] as TournamentTestRewardAction;
	if (action === "finish") {
		const fixture = await finishTournamentFixture(context);
		return `Tournoi ${fixture.tournament.id} terminé et récompenses préparées`;
	}
	if (action === "claim") {
		return await claimTournamentFixture(context, player, false, false);
	}
	if (action === "claimall") {
		return await claimTournamentFixture(context, player, true, false);
	}
	if (action === "retry") {
		return await claimTournamentFixture(context, player, false, true);
	}
	throw new Error("Action attendue : finish, claim, claimall ou retry");
};

commandInfo.execute = tournamentRewardTestCommand;
