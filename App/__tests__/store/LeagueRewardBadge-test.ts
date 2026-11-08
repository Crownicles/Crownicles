import { createElement } from "react";
import {
	renderHook, waitFor
} from "@testing-library/react-native";
import {
	QueryClient, QueryClientProvider
} from "@tanstack/react-query";
import { LeagueInfoRes } from "ws-packets/src/fromServer/fight/RankingsRes";
import { ProfileRes } from "ws-packets/src/fromServer/profile/ProfileRes";
import { GameClient } from "@/src/networking/GameClient";
import { usePlayerProfile } from "@/src/store/usePlayerProfile";
import { useReportView } from "@/src/store/useReportActions";
import {
	useLeagueInfo, useLeagueRewardToClaim
} from "@/src/store/useClaimables";

jest.mock("@/src/networking/GameClient", () => ({ GameClient: { request: jest.fn() } }));
jest.mock("@/src/store/usePlayerProfile", () => ({ usePlayerProfile: jest.fn() }));
jest.mock("@/src/store/useReportActions", () => ({ useReportView: jest.fn() }));
jest.mock("@/src/translations/i18n", () => ({ i18n: { t: (key: string): string => key } }));

const NO_EFFECT = {
	effect: "none", hasTimeDisplay: false, healed: false, timeLeft: 0
};
const OCCUPIED = {
	effect: "occupied", hasTimeDisplay: true, healed: false, timeLeft: 8_400_000
};

function profileOf(profile: Partial<ProfileRes> = {}): ProfileRes {
	return {
		level: 30, effect: NO_EFFECT, ...profile
	} as ProfileRes;
}

describe("league reward badge", () => {
	it("hides the arena's badge while the player is busy, and shows it once free", async () => {
		jest.mocked(GameClient.request).mockResolvedValue({
			kind: "answer", packet: Object.assign(new LeagueInfoRes(), { rewardAvailability: null })
		});
		jest.mocked(useReportView).mockReturnValue({ status: "loading" });
		jest.mocked(usePlayerProfile).mockReturnValue({
			status: "ready", data: profileOf({ effect: OCCUPIED })
		});
		const client = new QueryClient({ defaultOptions: { queries: {
			retry: false, gcTime: Infinity
		} } });
		const hook = await renderHook(() => ({
			league: useLeagueInfo().status, badge: useLeagueRewardToClaim()
		}), { wrapper: ({ children }) => createElement(QueryClientProvider, { client }, children) });
		await waitFor(() => expect(hook.result.current.league).toBe("ready"));
		expect(hook.result.current.badge).toBe(0);

		jest.mocked(usePlayerProfile).mockReturnValue({
			status: "ready", data: profileOf()
		});
		await hook.rerender({});
		expect(hook.result.current.badge).toBe(1);
	});
});
