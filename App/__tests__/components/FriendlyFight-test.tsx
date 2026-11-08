import {
	act, fireEvent, render, screen
} from "@testing-library/react-native";
import { FriendlyFightReq } from "ws-packets/src/fromClient/FightReq";
import {
	FightIntroductionRes, FriendlyFightErrorRes
} from "ws-packets/src/fromServer/fight/FightRes";
import { FRIENDLY_FIGHT_ERRORS } from "ws-packets/src/objects/Fight";
import { FriendlyFightPlayer } from "@/src/components/FriendlyFight";
import { GameClient } from "@/src/networking/GameClient";
import { usePlayerProfile } from "@/src/store/usePlayerProfile";
import { ProfileRes } from "ws-packets/src/fromServer/profile/ProfileRes";

jest.mock("@/src/networking/GameClient", () => ({ GameClient: { request: jest.fn() } }));
jest.mock("@/src/store/usePlayerProfile", () => ({ usePlayerProfile: jest.fn() }));
jest.mock("@/src/translations/i18n", () => ({ i18n: {
	language: "fr",
	t: (key: string, options?: Record<string, unknown>): string => {
		const value = options?.level ?? options?.levelCap;
		return value === undefined ? key : `${key}:${String(value)}`;
	}
} }));

const NO_EFFECT = {
	effect: "none", hasTimeDisplay: false, healed: false, timeLeft: 0
};
const START_LABEL = "app:friendlyFight.start";

function profile(level: number, effect: object = NO_EFFECT): ProfileRes {
	return {
		pseudo: "Rival", level, badges: [], missions: {}, rank: {}, effect
	} as never;
}

function renderBanner(ownLevel: number, opponentLevel: number, ownEffect?: object): Promise<unknown> {
	jest.mocked(usePlayerProfile).mockReturnValue({
		status: "ready", data: profile(ownLevel, ownEffect)
	} as never);
	return render(<FriendlyFightPlayer playerRef="opaque-ref" profile={profile(opponentLevel)} />);
}

describe("friendly fight from another player's profile", () => {
	afterEach(() => jest.clearAllMocks());

	it("says why before the press when the other player has not unlocked fights", async () => {
		await renderBanner(20, 2);
		expect(screen.getByText("app:friendlyFight.errors.opponentLevelTooLow")).toBeTruthy();
		const button = screen.getByRole("button", { name: START_LABEL });
		expect(button).toBeDisabled();
		await fireEvent.press(button);
		expect(GameClient.request).not.toHaveBeenCalled();
	});

	it("keeps the duel closed below the fight level", async () => {
		await renderBanner(3, 20);
		expect(screen.getByText("app:arena.locked:8")).toBeTruthy();
		expect(screen.getByRole("button", { name: START_LABEL })).toBeDisabled();
	});

	it("announces the level both fighters are brought down to, as the server rules set it", async () => {
		await renderBanner(20, 20);
		expect(screen.getByText("app:friendlyFight.detail:100")).toBeTruthy();
	});

	it("asks for the duel against the referenced player and lets the fight screen take over", async () => {
		jest.mocked(GameClient.request).mockResolvedValue({
			kind: "answer", packet: new FightIntroductionRes()
		});
		await renderBanner(20, 20);
		await act(() => fireEvent.press(screen.getByRole("button", { name: START_LABEL })));
		const [request, expected] = jest.mocked(GameClient.request).mock.calls[0];
		expect(request).toBeInstanceOf(FriendlyFightReq);
		expect(request).toMatchObject({ playerRef: "opaque-ref" });
		expect(expected).toBe(FightIntroductionRes);
		expect(screen.queryByText(/app:friendlyFight\.errors/u)).toBeNull();
	});

	it("shows the server's refusal where the duel was asked for", async () => {
		jest.mocked(GameClient.request).mockResolvedValue({
			kind: "alternative", packetName: FriendlyFightErrorRes.wireName, packet: Object.assign(new FriendlyFightErrorRes(), { error: FRIENDLY_FIGHT_ERRORS.OPPONENT_NOT_FOUND })
		});
		await renderBanner(20, 20);
		await act(() => fireEvent.press(screen.getByRole("button", { name: START_LABEL })));
		expect(screen.getByText("app:friendlyFight.errors.opponentNotFound")).toBeTruthy();
	});
});
