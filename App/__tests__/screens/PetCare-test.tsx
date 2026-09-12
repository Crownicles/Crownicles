import {fireEvent, render, screen, waitFor} from "@testing-library/react-native";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {PetNickname} from "@/src/components/PetNickname";
import {PetFeedCollector} from "@/src/collectors/PetFeedCollector";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {PetNickReq} from "ws-packets/src/fromClient/PetCareReq";
import {PetNickRes} from "ws-packets/src/fromServer/pet/PetCareRes";
import {GameClient} from "@/src/networking/GameClient";

jest.mock("expo-router", () => ({useFocusEffect: jest.fn()}));
jest.mock("@/src/networking/GameClient", () => ({GameClient: {request: jest.fn()}}));
jest.mock("@/src/AppIcons", () => ({AppIcons: {getIcon: (): string => "", getIconOrNull: (): null => null}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string): string => key}}));

const PET = {typeId: 1, nickname: "Aster", rarity: 1, sex: "m" as const, loveLevel: 3, force: 10, feedDelay: 2};

describe("pet care screens", () => {
	beforeEach(() => jest.clearAllMocks());

	it("submits a nickname and reports the server validation error", async () => {
		jest.mocked(GameClient.request).mockResolvedValue({kind: "answer", packet: Object.assign(new PetNickRes(), {foundPet: true, nickNameIsAcceptable: false, newNickname: "!"})});
		const client = new QueryClient({defaultOptions: {queries: {retry: false, gcTime: Infinity}}});
		await render(<QueryClientProvider client={client}><PetNickname pet={PET} /></QueryClientProvider>);
		await fireEvent.changeText(screen.getByLabelText("app:pet.care.newNickname"), "!");
		await fireEvent.press(screen.getByText("app:pet.care.save"));
		await waitFor(() => expect(screen.getByText("app:pet.care.invalidNickname")).toBeTruthy());
		expect(GameClient.request).toHaveBeenCalledWith(expect.any(PetNickReq), expect.any(Function), expect.any(Array));
		expect(jest.mocked(GameClient.request).mock.calls[0][0]).toMatchObject({newNickname: "!"});
	});

	it("clears the nickname only after the server confirms it", async () => {
		jest.mocked(GameClient.request).mockResolvedValue({kind: "answer", packet: Object.assign(new PetNickRes(), {foundPet: true, nickNameIsAcceptable: true, newNickname: ""})});
		const client = new QueryClient({defaultOptions: {queries: {retry: false, gcTime: Infinity}}});
		await render(<QueryClientProvider client={client}><PetNickname pet={PET} /></QueryClientProvider>);
		await fireEvent.press(screen.getByText("app:pet.care.clear"));
		await waitFor(() => expect(screen.getByDisplayValue("")).toBeTruthy());
		expect(screen.getByText("app:pet.care.cleared")).toBeTruthy();
	});

	it("keeps the feed confirmation's original index when unknown choices exist", async () => {
		const collector = Object.assign(new ReactionCollectorCreation(), {id: "feed", endTime: Date.now() + 60_000, data: {type: "petFeedPersonal", data: {pet: PET, food: "commonFood", price: 42}}, reactions: [{type: "unknown", data: {serverType: "future"}}, {type: "accept", data: {}}, {type: "refuse", data: {}}]});
		const onChoose = jest.fn();
		await render(<PetFeedCollector collector={collector} onChoose={onChoose} submitting={false} />);
		await fireEvent.press(screen.getByText("app:collector.accept"));
		expect(onChoose).toHaveBeenCalledWith(1);
	});
});