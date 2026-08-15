import { FromClientPacket } from "./FromClientPacket";

/**
 * Asks to drink a potion. The server answers with a collector listing the drinkable ones, so the
 * request carries no choice of its own.
 */
export class DrinkReq extends FromClientPacket {
}
