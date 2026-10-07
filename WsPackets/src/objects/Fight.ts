import { OwnedPet } from "./OwnedPet";
import { PetBasicInfo } from "./PetExpedition";
import { MaterialQuantity } from "./MaterialQuantity";
import { RecipeDisplay } from "./RecipeDisplay";

/** An island boss as it is announced before the player decides to face it. */
export type MonsterStats = {
	id: string; level: number; energy: number; attack: number; defense: number; speed: number;
};

/** What beating (or drawing with) an island boss brought back. */
export type MonsterReward = {
	money: number;
	experience: number;
	guildXp: number;
	guildPoints: number;
	petReaction?: {
		reactionType: string; loveDelta: number; petId: number; petSex: string; petNickname?: string;
	};
	materialLoot?: MaterialQuantity[];
	discoveredRecipe?: RecipeDisplay;
};

export type FightPlayerStats = {
	pet?: PetBasicInfo & { isOnExpedition: boolean };
	classId: number;
	fightRanking: { glory: number };
	energy: {
		value: number; max: number;
	};
	attack: number;
	defense: number;
	speed: number;
	breath: {
		base: number; max: number; regen: number;
	};
};
export type FightParticipant = {
	isSelf: boolean; name?: string; monsterId?: string; classId?: number; level?: number;
};
export type FightFighterStats = {
	power: number; maxEnergy?: number; attack: number; defense: number; speed: number; breath: number; maxBreath: number; breathRegen: number;
};
export type FightFighter = FightParticipant & {
	glory?: number; alteration?: string; stats: FightFighterStats;
};
export type FightIntroduction = {
	fightId: string;
	initiator: FightParticipant;
	opponent: FightParticipant;
	initiatorActions: [string, number][];
	opponentActions: [string, number][];
	initiatorPet?: OwnedPet;
	opponentPet?: OwnedPet;
};
export type FightStatus = {
	fightId: string; numberOfTurn: number; maxNumberOfTurn: number; activeFighter: FightFighter; defendingFighter: FightFighter;
};
export type FightEffect = {
	newAlteration?: string; damages?: number; reflectedDamages?: number; attack?: number; defense?: number; speed?: number; breath?: number; energy?: number;
};
export type FightLogEntry = {
	fightId: string;
	fighter: FightParticipant;
	fightActionId: string;
	usedFightActionId?: string;
	customMessage?: boolean;
	customMessageFail?: boolean;
	status?: string;
	pet?: OwnedPet;
	stateAfter?: FightStatus;
	fightActionEffectDealt?: FightEffect;
	fightActionEffectReceived?: FightEffect;
};
export type FightEnd = {
	winner: FightParticipant & {
		finalEnergy: number; maxEnergy: number;
	};
	loser: FightParticipant & {
		finalEnergy: number; maxEnergy: number;
	};
	draw: boolean;
	turns: number;
	maxTurns: number;
};
export type FightRankingChange = FightParticipant & {
	oldGlory: number; newGlory: number; oldLeagueId: number; newLeagueId: number;
};
export type FightReward = {
	points: number;
	money: number;
	draw: boolean;
	won: boolean;
	player1: FightRankingChange;
	player2: FightRankingChange;
	petLoveChange?: {
		loveChange: number; reactionType: string; petId: number; petSex: string; petNickname: string | null;
	};
};
export const FIGHT_ERRORS = {
	ENERGY: "energy", NO_OPPONENT: "noOpponent", REFUSED: "refused", BUGGED: "bugged"
} as const;
export type FightError = typeof FIGHT_ERRORS[keyof typeof FIGHT_ERRORS];
