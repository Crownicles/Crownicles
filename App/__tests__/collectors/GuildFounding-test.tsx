import {fireEvent, render, screen} from "@testing-library/react-native";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {GuildFoundingCollector} from "@/src/collectors/GuildFoundingCollector";
import {GuildOutcome} from "@/src/collectors/GuildOutcome";
import {usePlayerProfile} from "@/src/store/usePlayerProfile";
import {formatNumber} from "@/src/display/Amounts";

jest.mock("@/src/store/usePlayerProfile", () => ({usePlayerProfile: jest.fn()}));
jest.mock("@/src/AppIcons", () => ({AppIcons: {getIcon: (): string => "", getIconOrNull: (): null => null}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string): string => key}}));

const FOUNDING = Object.assign(new ReactionCollectorCreation(), {
	id: "founding",
	endTime: Date.now() + 60_000,
	data: {type: "guildCreate", data: {guildName: "Bananes", price: 5_000}},
	reactions: [{type: "accept", data: {}}, {type: "refuse", data: {}}]
});

describe("founding a guild", () => {
	beforeEach(() => jest.mocked(usePlayerProfile).mockReturnValue({status: "ready", data: {money: 12_000}} as never));

	it("shows the banner's name, its cost and what the purse keeps", async () => {
		await render(<GuildFoundingCollector collector={FOUNDING} onChoose={jest.fn()} submitting={false} />);
		expect(screen.getByText("Bananes")).toBeTruthy();
		expect(screen.getByText("app:guild.founding.cost")).toBeTruthy();
		expect(screen.getByText(formatNumber(7_000))).toBeTruthy();
	});

	it.each([
		{label: "app:guild.founding.confirm", index: 0},
		{label: "app:guild.founding.cancel", index: 1}
	])("answers $label with the server's reaction index", async ({label, index}) => {
		const choose = jest.fn();
		await render(<GuildFoundingCollector collector={FOUNDING} onChoose={choose} submitting={false} />);
		await fireEvent.press(screen.getByText(label));
		expect(choose).toHaveBeenCalledWith(index);
	});

	it("celebrates the new guild instead of reporting it in a sheet", async () => {
		const onContinue = jest.fn();
		await render(<GuildOutcome outcome={{type: "created", guildName: "Bananes"}} onContinue={onContinue} />);
		expect(screen.getByTestId("guild-founded")).toBeTruthy();
		expect(screen.getByText("Bananes")).toBeTruthy();
		await fireEvent.press(screen.getByText("app:guild.founded.enter"));
		expect(onContinue).toHaveBeenCalled();
	});
});
