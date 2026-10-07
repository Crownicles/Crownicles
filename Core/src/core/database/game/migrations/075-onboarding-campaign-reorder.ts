import { QueryInterface } from "sequelize";

type FrozenCampaignMission = {
	missionId: string;
	missionVariant: number;
	missionObjective: number;
	gemsToWin: number;
	xpToWin: number;
	moneyToWin: number;
};

/** The first campaign missions before the royal contest onboarding, frozen here so the migration never drifts with campaign.json. */
const PREVIOUS_ORDER: FrozenCampaignMission[] = [
	{
		missionId: "commandMission", missionVariant: 0, missionObjective: 1, gemsToWin: 1, xpToWin: 10, moneyToWin: 0
	},
	{
		missionId: "commandReport", missionVariant: 0, missionObjective: 1, gemsToWin: 1, xpToWin: 20, moneyToWin: 0
	},
	{
		missionId: "earnMoney", missionVariant: 0, missionObjective: 100, gemsToWin: 1, xpToWin: 25, moneyToWin: 0
	},
	{
		missionId: "travelHours", missionVariant: 1, missionObjective: 1, gemsToWin: 1, xpToWin: 25, moneyToWin: 0
	},
	{
		missionId: "reachLevel", missionVariant: 0, missionObjective: 5, gemsToWin: 1, xpToWin: 50, moneyToWin: 0
	},
	{
		missionId: "findOrBuyItem", missionVariant: 0, missionObjective: 1, gemsToWin: 2, xpToWin: 20, moneyToWin: 0
	},
	{
		missionId: "chooseClass", missionVariant: 0, missionObjective: 1, gemsToWin: 3, xpToWin: 100, moneyToWin: 0
	},
	{
		missionId: "travelHours", missionVariant: 3, missionObjective: 1, gemsToWin: 1, xpToWin: 75, moneyToWin: 0
	},
	{
		missionId: "drinkPotion", missionVariant: 0, missionObjective: 1, gemsToWin: 1, xpToWin: 25, moneyToWin: 0
	},
	{
		missionId: "commandMap", missionVariant: 0, missionObjective: 1, gemsToWin: 1, xpToWin: 40, moneyToWin: 0
	},
	{
		missionId: "goToPlace", missionVariant: 3, missionObjective: 1, gemsToWin: 2, xpToWin: 100, moneyToWin: 0
	},
	{
		missionId: "visitCityNpc", missionVariant: 2, missionObjective: 1, gemsToWin: 1, xpToWin: 30, moneyToWin: 0
	},
	{
		missionId: "recoverAlteration", missionVariant: 0, missionObjective: 1, gemsToWin: 1, xpToWin: 25, moneyToWin: 0
	},
	{
		missionId: "sellItems", missionVariant: 0, missionObjective: 1, gemsToWin: 1, xpToWin: 25, moneyToWin: 0
	},
	{
		missionId: "sleepInInn", missionVariant: 0, missionObjective: 1, gemsToWin: 1, xpToWin: 25, moneyToWin: 0
	},
	{
		missionId: "reachLevel", missionVariant: 0, missionObjective: 8, gemsToWin: 1, xpToWin: 50, moneyToWin: 0
	}
];

/** For each new position (1-indexed), the previous position of the mission now standing there. */
export const ONBOARDING_ORDER = [
	1,
	2,
	3,
	6,
	9,
	10,
	12,
	7,
	4,
	15,
	14,
	13,
	5,
	8,
	11,
	16
];

const REORDERED_LENGTH = ONBOARDING_ORDER.length;

function inverse(order: number[]): number[] {
	const inverted: number[] = [];
	order.forEach((previous, index) => {
		inverted[previous - 1] = index + 1;
	});
	return inverted;
}

/** Rebuilds the blob so each completion follows its mission to its new position. */
function permutedBlob(order: number[]): string {
	const moved = order.map(previous => `SUBSTRING(pmi.campaignBlob, ${previous}, 1)`).join(", ");
	return `CONCAT(${moved}, SUBSTRING(pmi.campaignBlob, ${REORDERED_LENGTH + 1}))`;
}

function slotCase(missions: FrozenCampaignMission[], value: (mission: FrozenCampaignMission) => string): string {
	const firstOpen = `LOCATE('0', LEFT(pmi.campaignBlob, ${REORDERED_LENGTH}))`;
	return `CASE ${firstOpen} ${missions.map((mission, index) => `WHEN ${index + 1} THEN ${value(mission)}`).join(" ")} END`;
}

/** Progress a freshly assigned campaign mission starts with, as its mission interface computes it. */
function initialNumberDone(mission: FrozenCampaignMission): string {
	switch (mission.missionId) {
		case "reachLevel":
			return "p.level";
		case "chooseClass":
			return "IF(p.class <> 0, 1, 0)";
		default:
			return "0";
	}
}

async function reorder(context: QueryInterface, order: number[], before: FrozenCampaignMission[]): Promise<void> {
	const after = order.map(previous => before[previous - 1]);
	const inRange = `pmi.campaignProgression BETWEEN 1 AND ${REORDERED_LENGTH} AND LENGTH(pmi.campaignBlob) > ${REORDERED_LENGTH}`;

	// Players past these missions have them all completed: permuting their blob changes nothing.
	await context.sequelize.query(`
		UPDATE player_missions_info pmi
		SET pmi.campaignBlob = ${permutedBlob(order)}
		WHERE ${inRange}
	`);

	const newMissionId = slotCase(after, mission => `'${mission.missionId}'`);
	const newVariant = slotCase(after, mission => `${mission.missionVariant}`);
	const newObjective = slotCase(after, mission => `${mission.missionObjective}`);

	// A player whose current mission is unchanged keeps its progress on it.
	await context.sequelize.query(`
		UPDATE mission_slots ms
		JOIN player_missions_info pmi ON pmi.playerId = ms.playerId
		JOIN players p ON p.id = ms.playerId
		SET ms.missionId = ${newMissionId},
		    ms.missionVariant = ${newVariant},
		    ms.missionObjective = ${newObjective},
		    ms.gemsToWin = ${slotCase(after, mission => `${mission.gemsToWin}`)},
		    ms.xpToWin = ${slotCase(after, mission => `${mission.xpToWin}`)},
		    ms.moneyToWin = ${slotCase(after, mission => `${mission.moneyToWin}`)},
		    ms.numberDone = ${slotCase(after, initialNumberDone)},
		    ms.saveBlob = NULL
		WHERE ms.expiresAt IS NULL
		  AND ${inRange}
		  AND (ms.missionId <> ${newMissionId} OR ms.missionVariant <> ${newVariant} OR ms.missionObjective <> ${newObjective})
	`);

	await context.sequelize.query(`
		UPDATE player_missions_info pmi
		SET pmi.campaignProgression = LOCATE('0', LEFT(pmi.campaignBlob, ${REORDERED_LENGTH}))
		WHERE ${inRange}
	`);
}

/*
 * The royal contest onboarding (#4796) teaches the game in the order a newcomer meets it:
 * missions, report, royal purse, then an item, a potion, the map on the road, the first
 * city, up to the class. The first sixteen campaign missions are permuted accordingly; completions
 * move with their mission, so no player loses or regains a finished mission.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await reorder(context, ONBOARDING_ORDER, PREVIOUS_ORDER);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await reorder(context, inverse(ONBOARDING_ORDER), ONBOARDING_ORDER.map(previous => PREVIOUS_ORDER[previous - 1]));
}
