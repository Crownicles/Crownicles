export type ClassKind = "basic" | "attack" | "defense" | "other";

export type ClassStats = {
	attack: number;
	defense: number;
	speed: number;
	health: number;
	classGroup: number;
	fightPoint: number;
	baseBreath: number;
	maxBreath: number;
	breathRegen: number;
	classKind: ClassKind;
};

export type ClassDetails = {
	id: number;
	stats: ClassStats;
	attacks: {
		id: string;
		cost: number;
	}[];
};

export type AvailableClass = {
	id: number;
	energy: number;
	attack: number;
	defense: number;
	speed: number;
	initialBreath: number;
	maxBreath: number;
	breathRegen: number;
	health: number;
};
