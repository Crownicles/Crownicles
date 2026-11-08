import { render } from "@testing-library/react-native";
import { ProfileRes } from "ws-packets/src/fromServer/profile/ProfileRes";
import { CrowniclesIcons } from "../../../Lib/src/CrowniclesIcons";
import { AppIcons } from "@/src/AppIcons";
import { ProfileView } from "@/src/components/ProfileView";

jest.mock("@/src/translations/i18n", () => ({ i18n: { t: (key: string): string => key } }));

const PROFILE = {
	pseudo: "Marin",
	classId: 1,
	level: 12,
	health: {
		value: 80, max: 100
	},
	experience: {
		value: 25, max: 100
	},
	money: 400,
	tokens: {
		value: 3, max: 10
	},
	kingChallengeTier: 0,
	missions: {
		gems: 8, campaignProgression: 50
	},
	rank: {
		unranked: false, rank: 2, numberOfPlayers: 10, score: 900
	},
	effect: {
		healed: true, timeLeft: 0, effect: "none", hasTimeDisplay: false
	},
	stats: {
		energy: {
			value: 10, max: 20
		},
		attack: 5,
		defense: 6,
		speed: 7,
		breath: {
			base: 2, max: 4, regen: 1
		}
	},
	badges: [],
	guild: "Aurore",
	pet: {
		typeId: 1, sex: "f", nickname: "Rex", rarity: 2
	}
} as ProfileRes;

describe("profile icons", () => {
	it("asks only for icons the game defines, so no line shows the missing icon instead of its own", async () => {
		AppIcons.reloadAppIcons(CrowniclesIcons);
		const missing: string[] = [];
		jest.spyOn(AppIcons, "getIcon").mockImplementation((path: string): string => {
			const icon = AppIcons.getIconOrNull(path);
			if (icon === null) {
				missing.push(path);
			}
			return icon ?? "";
		});
		await render(<ProfileView profile={PROFILE} />);
		expect(missing).toEqual([]);
	});
});
