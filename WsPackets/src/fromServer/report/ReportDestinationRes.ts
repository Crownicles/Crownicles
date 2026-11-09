import { FromServerPacket } from "../FromServerPacket";

/**
 * A destination was chosen. The trip itself reaches the app through the refreshed report view: this
 * packet only carries what the view cannot tell afterwards.
 */
export class ReportDestinationRes extends FromServerPacket {
	public static readonly wireName = "ReportDestinationRes";

	/** Points credited for the stay in the city the player just left. */
	cityStayScore?: number;
}
