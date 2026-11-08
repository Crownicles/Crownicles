import {
	act, fireEvent, render, screen
} from "@testing-library/react-native";
import { KingChallengeTierReachedRes } from "ws-packets/src/fromServer/missions/KingChallengeTierReachedRes";
import { PlayerLevelUpRes } from "ws-packets/src/fromServer/character/PlayerLevelUpRes";
import { KingChallengeToast } from "@/src/components/KingChallengeToast";
import { kingChallengeTierStore } from "@/src/store/KingChallengeStore";
import { levelUpStore } from "@/src/store/LevelUpStore";
import { ADVENTURE_KING_CHALLENGE } from "@/src/navigation/AdventureTools";
import { WebSocketClient } from "@/src/networking/WebSocketClient";

const mockNavigate = jest.fn();
jest.mock("expo-router", () => ({ useRouter: (): object => ({ navigate: mockNavigate }) }));
jest.mock("@/src/translations/i18n", () => ({ i18n: {
	language: "en",
	t: (key: string, options?: object): string => options ? `${key} ${JSON.stringify(options)}` : key
} }));
jest.mock("@/src/AppIcons", () => ({ AppIcons: { getIcon: (path: string): string => `icon:${path}` } }));
jest.mock("@/src/components/UnlockCelebration", () => ({ useAdventureBusy: jest.fn(() => false) }));
jest.mock("@/src/journey/useJourney", () => ({ useJourney: (): object => ({ unannounced: null }) }));
jest.mock("@/src/store/MissionRewardsStore", () => ({ useMissionRewards: jest.fn(() => ({ unannounced: 0 })) }));

const SINGLE_TIER_TITLE = "app:kingChallenge.toast.title {\"count\":1,\"tier\":2,\"tierCount\":4}";

function dispatch(wireName: string, packet: object): void {
	Reflect.get(WebSocketClient.getInstance(), "pushedPacketRegistry").dispatch(wireName, packet);
}

async function crossTiers(values: Partial<KingChallengeTierReachedRes> = {}): Promise<void> {
	const packet: KingChallengeTierReachedRes = {
		self: true,
		tier: 2,
		crossedTiers: 1,
		reward: {
			money: 1_250, tokens: 2, gems: 0
		},
		ownedTokens: 6,
		...values
	};
	await act(async () => dispatch(KingChallengeTierReachedRes.wireName, packet));
}

describe("KingChallengeToast", () => {
	afterEach(async () => {
		await act(async () => {
			kingChallengeTierStore.announced();
			levelUpStore.announced();
		});
		mockNavigate.mockClear();
	});

	it("tells the tier crossed and what the king paid, and opens the challenge when tapped", async () => {
		await render(<KingChallengeToast />);
		await crossTiers();

		expect(screen.getByText("app:kingChallenge.toast.money {\"amount\":\"1,250\"} · app:kingChallenge.toast.tokens {\"amount\":\"2\"}")).toBeTruthy();
		await fireEvent.press(screen.getByText(SINGLE_TIER_TITLE));
		expect(mockNavigate).toHaveBeenCalledWith(ADVENTURE_KING_CHALLENGE);
		expect(screen.queryByText(SINGLE_TIER_TITLE)).toBeNull();
	});

	it("counts the tiers crossed at once", async () => {
		await render(<KingChallengeToast />);
		await crossTiers({
			tier: 3, crossedTiers: 2
		});
		expect(screen.getByText("app:kingChallenge.toast.title {\"count\":2,\"tier\":3,\"tierCount\":4}")).toBeTruthy();
	});

	it("says why no token came when the player already held the cap", async () => {
		await render(<KingChallengeToast />);
		await crossTiers({
			reward: {
				money: 1_250, tokens: 0, gems: 0
			},
			ownedTokens: 22
		});
		expect(screen.getByText("app:kingChallenge.toast.money {\"amount\":\"1,250\"} · app:kingChallenge.toast.tokensWithheld {\"tokens\":\"22\"}")).toBeTruthy();
	});

	it("says nothing about the crossing of another player", async () => {
		await render(<KingChallengeToast />);
		await crossTiers({ self: false });
		expect(screen.queryByText(SINGLE_TIER_TITLE)).toBeNull();
	});

	it("lets the level gained with the same action be told first", async () => {
		const levelUp: PlayerLevelUpRes = {
			self: true, level: 5, healthRestored: true, statsIncreased: true, missionSlotUnlocked: false
		};
		await act(async () => dispatch(PlayerLevelUpRes.wireName, levelUp));
		await render(<KingChallengeToast />);
		await crossTiers();
		expect(screen.queryByText(SINGLE_TIER_TITLE)).toBeNull();

		await act(async () => levelUpStore.announced());
		expect(screen.getByText(SINGLE_TIER_TITLE)).toBeTruthy();
	});
});
