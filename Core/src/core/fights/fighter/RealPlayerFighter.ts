import { PlayerFighter } from "./PlayerFighter";

/**
 * Class representing a real player in a fight.
 * Behaves exactly like a PlayerFighter, but is a distinct type so PVE code can tell it apart from the fighters of a PVP fight.
 */
export class RealPlayerFighter extends PlayerFighter {
}
