import {
	TournamentErrorCode
} from "../../../../Lib/src/packets/commands/CommandTournamentPacket";

export class TournamentDomainError extends Error {
	public readonly code: TournamentErrorCode;

	public constructor(code: TournamentErrorCode) {
		super(code);
		this.name = "TournamentDomainError";
		this.code = code;
	}
}
