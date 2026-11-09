import { FromClientPacket } from "./FromClientPacket";

/** Opens the choice of the style the AI defends the player with when another player attacks them. */
export class DefenseReq extends FromClientPacket {
	public static readonly wireName = "DefenseReq";
}
