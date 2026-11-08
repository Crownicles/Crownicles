import {
	render, screen, within
} from "@testing-library/react-native";
import { GuildOutcome } from "@/src/collectors/GuildOutcome";

const ICONS: Record<string, string> = {
	"unitValues.money": "💰",
	"unitValues.xp": "⭐",
	"unitValues.guildPoint": "🪩",
	"foods.commonFood": "🍬",
	"pets.3.emoteFemale": "🐈"
};

jest.mock("@/src/AppIcons", () => ({ AppIcons: {
	getIcon: (path: string): string => ICONS[path] ?? "", getIconOrNull: (path: string): string | null => ICONS[path] ?? null
} }));
jest.mock("@/src/translations/i18n", () => ({ i18n: { t: (key: string, options?: Record<string, unknown>): string => {
	if (key === "commands:guildDaily.rewardTitle") {
		return `Récompense de la guilde ${String(options?.guildName)} :`;
	}
	if (key === "commands:pet.shortPetField") {
		return `${String(options?.emote)} ${String(options?.name)}`;
	}
	if (key === "app:guild.rewards.pet") {
		return `pet: ${String(options?.pet)}`;
	}
	return key;
} } }));

describe("guild daily reward", () => {
	it("introduces the gains with a sentence naming the guild, each gain with the emoji of what it adds", async () => {
		await render(<GuildOutcome outcome={{
			type: "daily",
			reward: {
				guildName: "Aurore",
				money: 120,
				personalXp: 40,
				guildPoints: 25,
				commonFood: 3,
				pet: {
					typeId: 3, isFemale: true
				}
			}
		}} onContinue={jest.fn()} />);
		expect(screen.getByText("app:guild.daily")).toBeTruthy();
		expect(screen.getByText("Récompense de la guilde Aurore :")).toBeTruthy();
		expect(screen.queryByText("Aurore")).toBeNull();

		const gains = screen.getAllByTestId("event-effect");
		expect(gains).toHaveLength(4);
		const gain = (label: string): ReturnType<typeof within> => within(gains.find(chip => within(chip).queryByText(label) !== null)!);
		expect(gain("app:guild.rewards.money").getByText("+120")).toBeTruthy();
		expect(gain("app:guild.rewards.money").getByLabelText("💰")).toBeTruthy();
		expect(gain("app:guild.rewards.personalXp").getByLabelText("⭐")).toBeTruthy();
		expect(gain("app:guild.rewards.guildPoints").getByText("+25")).toBeTruthy();
		expect(gain("app:guild.rewards.guildPoints").getByLabelText("🪩")).toBeTruthy();
		expect(gain("app:guild.rewards.commonFood").getByLabelText("🍬")).toBeTruthy();
		expect(screen.getByLabelText("🐈")).toBeTruthy();
		expect(screen.getByText("models:pets:3")).toBeTruthy();
	});
});
