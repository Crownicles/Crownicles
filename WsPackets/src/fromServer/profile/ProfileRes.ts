import { FromServerPacket } from "../FromServerPacket";
import { PetSex } from "../../objects/OwnedPet";
import { ValueAndMax } from "../../objects/ValueAndMax";

type Breath = {
	base: number;

	max: number;

	regen: number;
};

type Stats = {
	energy: ValueAndMax;

	attack: number;

	defense: number;

	speed: number;

	breath: Breath;
};

type Missions = {
	gems: number;

	campaignProgression: number;
};

type Rank = {
	unranked: boolean;

	rank: number;

	numberOfPlayers: number;

	score: number;
};

type Effect = {
	healed: boolean;

	timeLeft: number;

	effect: string;

	hasTimeDisplay: boolean;
};

type Pet = {
	typeId: number;

	sex: PetSex;

	rarity: number;

	nickname: string;
};

type FightRanking = {
	glory: number;

	gloryRank: number;

	numberOfFighters: number;

	league: number;
};

type Cooking = {
	level: number;

	grade: string;

	experience: ValueAndMax;
};

export class ProfileRes extends FromServerPacket {
	badges!: string[];

	stats?: Stats;

	missions!: Missions;

	rank!: Rank;

	effect!: Effect;

	classId?: number;

	fightRanking?: FightRanking;

	guild?: string;

	destinationId?: number;

	mapTypeId?: string;

	pet?: Pet;

	color?: string;

	level!: number;

	health!: ValueAndMax;

	experience!: ValueAndMax;

	money!: number;

	tokens?: ValueAndMax;

	cooking?: Cooking;

	pseudo!: string;
}
