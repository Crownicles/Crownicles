import type { SexTypeShort } from "../constants/StringConstants";

export type FightPlayerStats = {
	pet?: {
		petTypeId: number;
		petSex: SexTypeShort;
		petNickname: string;
		isOnExpedition: boolean;
	};
	classId: number;
	fightRanking: { glory: number };
	energy: {
		value: number;
		max: number;
	};
	attack: number;
	defense: number;
	speed: number;
	breath: {
		base: number;
		max: number;
		regen: number;
	};
};
