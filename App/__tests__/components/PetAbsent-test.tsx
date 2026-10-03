import {fireEvent, render, screen} from "@testing-library/react-native";
import {PetAbsent} from "@/src/components/PetAbsent";
import {usePlayerProfile} from "@/src/store/usePlayerProfile";

const mockPush = jest.fn();
const mockNavigate = jest.fn();

jest.mock("expo-router", () => ({useRouter: (): object => ({push: mockPush, navigate: mockNavigate})}));
jest.mock("@/src/store/usePlayerProfile", () => ({usePlayerProfile: jest.fn()}));
jest.mock("@/src/AppIcons", () => ({AppIcons: {getIcon: (): string => "", getIconOrNull: (): null => null}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string): string => key}}));

async function renderWith(guild: object | undefined): Promise<void> {
	jest.mocked(usePlayerProfile).mockReturnValue({status: "ready", data: {guild}} as never);
	await render(<PetAbsent />);
}

describe("pet tab without a pet", () => {
	afterEach(() => jest.clearAllMocks());

	it("leads a guild member to the shelter", async () => {
		await renderWith({name: "Les Lions"});
		expect(screen.getByText("app:pet.absent.shelterHint")).toBeTruthy();
		await fireEvent.press(screen.getByRole("button", {name: "app:pet.absent.visitShelter"}));
		expect(mockPush).toHaveBeenCalledWith("/guild/shelter");
	});

	it("sends a player without a guild back on the road", async () => {
		await renderWith(undefined);
		expect(screen.getByText("app:pet.absent.shelterNoGuild")).toBeTruthy();
		await fireEvent.press(screen.getByRole("button", {name: "app:pet.absent.continue"}));
		expect(mockNavigate).toHaveBeenCalledWith("/");
	});
});
