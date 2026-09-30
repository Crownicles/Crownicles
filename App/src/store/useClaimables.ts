import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {InventoryReq} from "ws-packets/src/fromClient/InventoryReq";
import {LeagueInfoReq} from "ws-packets/src/fromClient/RankingsReq";
import {InventoryRes} from "ws-packets/src/fromServer/inventory/InventoryRes";
import {LeagueInfoRes} from "ws-packets/src/fromServer/fight/RankingsRes";
import {GuildRes} from "ws-packets/src/fromServer/guild/GuildRes";
import {PlayerNotFound} from "ws-packets/src/fromServer/common/PlayerNotFound";
import {GameClient} from "@/src/networking/GameClient";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {RequestState, useGameQuery} from "@/src/store/useGameQuery";
import {useOwnGuild} from "@/src/store/useGuild";
import {useMissionRewards} from "@/src/store/MissionRewardsStore";
import {givesDailyBonus} from "@/src/display/ItemEffects";
import {useCurrentTime} from "@/src/store/useCurrentTime";
import {JOURNEY_TABS, JourneyTab} from "@/src/journey/Journey";

/** A daily bonus or a guild reward becomes available on its own: the pills look at the clock this often. */
const CLAIMABLES_TICK_MS = 30_000;

/** The player's own inventory, one query shared by every screen that needs it. */
export function useOwnInventory(): RequestState<InventoryRes> {
	return useGameQuery(
		GAME_ENTITIES.INVENTORY,
		() => GameClient.request(makeFromClientPacket(InventoryReq, {askedPlayer: {}}), InventoryRes, [PlayerNotFound])
	);
}

/** The leagues and where the player stands among them. */
export function useLeagueInfo(): RequestState<LeagueInfoRes> {
	return useGameQuery(GAME_ENTITIES.LEAGUES, () => GameClient.request(makeFromClientPacket(LeagueInfoReq, {}), LeagueInfoRes));
}

/** The daily bonus waits once its delay ran out and an object, worn or kept aside, can give it. */
export function dailyBonusClaimable(state: RequestState<InventoryRes>, now: number): boolean {
	if (state.status !== "ready" || now === 0) return false;
	const {data, dailyBonusAvailableAt} = state.data;
	if (!data) return false;
	const waiting = dailyBonusAvailableAt === undefined || dailyBonusAvailableAt > now;
	if (waiting) return false;
	return givesDailyBonus(data.object) || data.backupObjects.some(entry => givesDailyBonus(entry.display));
}

/** Core says outright whether the season reward can be claimed. */
export function leagueRewardClaimable(state: RequestState<LeagueInfoRes>): boolean {
	return state.status === "ready" && state.data.rewardAvailability === null;
}

/** The guild reward waits once its delay ran out, unless a member exploring the island froze it. */
export function guildDailyClaimable(state: RequestState<GuildRes>, now: number): boolean {
	const daily = state.status === "ready" ? state.data.data?.membership?.daily : undefined;
	return daily !== undefined && now !== 0 && !daily.blockedByIsland && daily.availableAt <= now;
}

export function useMissionsToClaim(): number {
	return useMissionRewards().rewards.missions.length;
}

export function useDailyBonusToClaim(): number {
	const now = useCurrentTime(CLAIMABLES_TICK_MS);
	return dailyBonusClaimable(useOwnInventory(), now) ? 1 : 0;
}

export function useLeagueRewardToClaim(): number {
	return leagueRewardClaimable(useLeagueInfo()) ? 1 : 0;
}

export function useGuildDailyToClaim(): number {
	const now = useCurrentTime(CLAIMABLES_TICK_MS);
	return guildDailyClaimable(useOwnGuild(), now) ? 1 : 0;
}

/** How many rewards wait behind each tab, so the bar leads the player to them. */
export function useTabClaimables(): Partial<Record<JourneyTab, number>> {
	return {
		[JOURNEY_TABS.ADVENTURE]: useMissionsToClaim(),
		[JOURNEY_TABS.PROFILE]: useDailyBonusToClaim(),
		[JOURNEY_TABS.GUILD]: useGuildDailyToClaim(),
		[JOURNEY_TABS.ARENA]: useLeagueRewardToClaim()
	};
}
