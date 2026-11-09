export type FightFighterSnapshot = {
	keycloakId?: string;
	monsterId?: string;
	classId?: number;
	level?: number;
	alteration?: string;
	glory?: number;
	stats: {
		power: number;
		maxEnergy?: number;
		attack: number;
		defense: number;
		speed: number;
		breath: number;
		maxBreath: number;
		breathRegen: number;
	};
};

export type FightStatusSnapshot = {
	fightId: string;
	numberOfTurn: number;
	maxNumberOfTurn: number;
	activeFighter: FightFighterSnapshot;
	defendingFighter: FightFighterSnapshot;
};
