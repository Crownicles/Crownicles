import {ReactElement, ReactNode} from "react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {fireEvent, render, screen, waitFor} from "@testing-library/react-native";
import {makeFromServerPacket} from "ws-packets/src/MakePackets";
import {GuildJoinReq, GuildRecruitmentReq} from "ws-packets/src/fromClient/GuildRecruitmentReq";
import {
	GuildJoinErrorRes, GuildJoinRes, GuildRecruitmentErrorRes, GuildRecruitmentListRes, GuildRecruitmentRes
} from "ws-packets/src/fromServer/guild/GuildRecruitmentRes";
import {GUILD_JOIN_ERRORS, GUILD_RECRUITMENT_ERRORS, RecruitingGuild} from "ws-packets/src/objects/GuildRecruitment";
import {GuildJoin, RecruitmentSettings} from "@/src/components/GuildRecruitment";
import {GameClient} from "@/src/networking/GameClient";

const mockReplace = jest.fn();

jest.mock("expo-router", () => ({useRouter: (): object => ({replace: mockReplace})}));
jest.mock("@/src/networking/GameClient", () => ({GameClient: {request: jest.fn()}}));
jest.mock("@/src/AppIcons", () => ({AppIcons: {getIcon: (): string => "", getIconOrNull: (): null => null}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string, options?: Record<string, unknown>): string => options?.name ? `${key}:${String(options.name)}` : key}}));

const OPEN_GUILD: RecruitingGuild = {id: 3, name: "Aurore", level: 12, memberCount: 4, minScore: 1000};
const FULL_GUILD: RecruitingGuild = {id: 4, name: "Crépuscule", level: 30, memberCount: 6, minScore: 0, blocker: "full"};

function withClient(node: ReactNode): ReactElement {
	return <QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>{node}</QueryClientProvider>;
}

function sentPacket(call: number): unknown {
	return jest.mocked(GameClient.request).mock.calls[call][0];
}

describe("recruitment settings", () => {
	afterEach(() => {
		jest.mocked(GameClient.request).mockReset();
		mockReplace.mockClear();
	});

	it("raises the minimum score to the next step without typing", async () => {
		jest.mocked(GameClient.request)
			.mockResolvedValueOnce({kind: "answer", packet: makeFromServerPacket(GuildRecruitmentRes, {settings: {open: true, minScore: 1000}, changed: false})})
			.mockResolvedValueOnce({kind: "answer", packet: makeFromServerPacket(GuildRecruitmentRes, {settings: {open: true, minScore: 2500}, changed: true})});
		await render(<RecruitmentSettings />);
		expect(await screen.findByText(/^1\D?000$/)).toBeTruthy();
		await fireEvent.press(screen.getByRole("button", {name: "app:guild.recruitment.raise"}));
		expect(sentPacket(1)).toBeInstanceOf(GuildRecruitmentReq);
		expect(sentPacket(1)).toMatchObject({minScore: 2500});
		expect(await screen.findByText(/^2\D?500$/)).toBeTruthy();
	});

	it("explains that the guild needs an office first", async () => {
		jest.mocked(GameClient.request).mockResolvedValueOnce({kind: "alternative", packetName: GuildRecruitmentErrorRes.wireName, packet: makeFromServerPacket(GuildRecruitmentErrorRes, {error: GUILD_RECRUITMENT_ERRORS.NO_OFFICE})});
		await render(<RecruitmentSettings />);
		expect(await screen.findByText("app:guild.recruitment.noOffice")).toBeTruthy();
		expect(screen.queryByRole("button", {name: "app:guild.recruitment.raise"})).toBeNull();
	});
});

describe("joining a guild", () => {
	afterEach(() => {
		jest.mocked(GameClient.request).mockReset();
		mockReplace.mockClear();
	});

	function suggest(): void {
		jest.mocked(GameClient.request).mockResolvedValueOnce({kind: "answer", packet: makeFromServerPacket(GuildRecruitmentListRes, {guilds: [OPEN_GUILD, FULL_GUILD], playerScore: 5000})});
	}

	it("joins a suggested guild, then goes back to the guild tab", async () => {
		suggest();
		jest.mocked(GameClient.request).mockResolvedValueOnce({kind: "answer", packet: makeFromServerPacket(GuildJoinRes, {guildName: "Aurore"})});
		await render(withClient(<GuildJoin />));
		await fireEvent.press(await screen.findByRole("button", {name: "Aurore"}));
		await fireEvent.press(screen.getByRole("button", {name: "app:guild.join.join:Aurore"}));
		expect(sentPacket(1)).toBeInstanceOf(GuildJoinReq);
		expect(sentPacket(1)).toMatchObject({guildId: OPEN_GUILD.id});
		await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/guild"));
	});

	it("does not let the player knock at a full guild", async () => {
		suggest();
		await render(withClient(<GuildJoin />));
		await fireEvent.press(await screen.findByRole("button", {name: "Crépuscule"}));
		expect(screen.getByText("app:guild.join.blockers.full")).toBeTruthy();
		expect(screen.getByRole("button", {name: "app:guild.join.join:Crépuscule"})).toBeDisabled();
	});

	it("says why the guild refused the player", async () => {
		suggest();
		jest.mocked(GameClient.request).mockResolvedValueOnce({kind: "alternative", packetName: GuildJoinErrorRes.wireName, packet: makeFromServerPacket(GuildJoinErrorRes, {error: GUILD_JOIN_ERRORS.CLOSED})});
		await render(withClient(<GuildJoin />));
		await fireEvent.press(await screen.findByRole("button", {name: "Aurore"}));
		await fireEvent.press(screen.getByRole("button", {name: "app:guild.join.join:Aurore"}));
		expect(await screen.findByText("commands:guildJoin.errors.closed")).toBeTruthy();
		expect(mockReplace).not.toHaveBeenCalled();
	});
});
