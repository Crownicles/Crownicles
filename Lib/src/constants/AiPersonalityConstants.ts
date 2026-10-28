/**
 * Personalities of the AI fighting on behalf of a player when another player attacks them.
 * Some classes have several viable ways to fight: the player picks the one defending them,
 * or lets a different one be picked at random at each fight. Attackers are never told which one defends.
 */
export abstract class AiPersonalityConstants {
	static readonly PERSONALITIES = {
		KNIGHT_STRATEGIST: "knightStrategist",
		KNIGHT_ENDURING: "knightEnduring",
		KNIGHT_FIERY: "knightFiery",
		TANK_BULWARK: "tankBulwark",
		TANK_RIPOSTE: "tankRiposte",
		PALADIN_CRUSADER: "paladinCrusader",
		PALADIN_JUSTICAR: "paladinJusticar",
		GUNNER_STRATEGIST: "gunnerStrategist",
		GUNNER_CANNONEER: "gunnerCannoneer",
		VETERAN_STRATEGIST: "veteranStrategist",
		VETERAN_CHARGER: "veteranCharger"
	} as const;
}

export type AiPersonality = (typeof AiPersonalityConstants.PERSONALITIES)[keyof typeof AiPersonalityConstants.PERSONALITIES];
