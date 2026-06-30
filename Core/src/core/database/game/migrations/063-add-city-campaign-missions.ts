import { QueryInterface } from "sequelize";
import {
	addCampaignMissionList, removeCampaignMissionList
} from "../GameDatabaseUtils";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	/*
	 * DRAFT PROPOSAL — add 15 city-life campaign missions (PR #4331)
	 *
	 * Positions below are in the ORIGINAL campaign (129 missions before this migration).
	 * addCampaignMissionList sorts positions in DESCENDING order and inserts one by one.
	 * IMPORTANT: when two new missions are consecutive in the final campaign, both use the
	 * SAME original position here (the algorithm preserves array order for equal positions).
	 *
	 * Final positions after migration (144 missions total):
	 * - buyHome:                  position 11
	 * - depositChestItem:         position 12
	 * - sleepInInn:               position 15
	 * - visitCityNpc (generalShop): position 16
	 * - upgradeItem:              position 22
	 * - replaceMission:           position 23
	 * - upgradeHomeLevel (lvl 2): position 29
	 * - enchantItem:              position 34
	 * - buyApartment:             position 44
	 * - collectRent:              position 45
	 * - joinGuildHouse:           position 57
	 * - haveGardenTalisman:       position 62
	 * - cultivateAncestralTrees:  position 113
	 * - upgradeEpicItemLevel5:    position 120
	 * - buyAllApartments:         position 140
	 */
	await addCampaignMissionList(context, [
		11, // buyHome
		11, // depositChestItem - same position for consecutive pair
		13, // sleepInInn
		13, // visitCityNpc - same position for consecutive pair
		18, // upgradeItem
		18, // replaceMission - same position for consecutive pair
		23, // upgradeHomeLevel (level 2)
		27, // enchantItem
		36, // buyApartment
		36, // collectRent - same position for consecutive pair
		47, // joinGuildHouse
		51, // haveGardenTalisman
		101, // cultivateAncestralTrees
		107, // upgradeEpicItemLevel5
		126 // buyAllApartments
	]);

	/*
	 * Players who already completed the campaign (campaignProgression = 0) must be pointed
	 * to the first newly-inserted mission (final position 11) so they receive the new content.
	 */
	await context.sequelize.query(`
		UPDATE player_missions_info
		SET campaignProgression = 11
		WHERE campaignProgression = 0
		  AND LENGTH(campaignBlob) > 0
	`);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await removeCampaignMissionList(context, [
		11,
		11,
		13,
		13,
		18,
		18,
		23,
		27,
		36,
		36,
		47,
		51,
		101,
		107,
		126
	]);
}
