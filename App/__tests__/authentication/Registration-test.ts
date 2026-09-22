import {
	MINIMUM_PASSWORD_LENGTH, REGISTRATION_FAILURES, RegistrationFailure,
	draftRejection, registerAccount
} from "@/src/authentication/Registration";
import {RestApi} from "@/src/networking/RestApi";

jest.mock("@/src/networking/RestApi", () => ({RestApi: {register: jest.fn()}}));
jest.mock("@/src/translations/i18nLoader", () => ({currentLanguage: (): string => "fr"}));

const validDraft = {
	username: "Aventurier",
	email: "joueur@example.com",
	password: "a".repeat(MINIMUM_PASSWORD_LENGTH)
};

describe("account registration", () => {
	beforeEach((): void => {
		jest.clearAllMocks();
	});

	it("accepts a complete draft", () => {
		expect(draftRejection(validDraft)).toBeNull();
	});

	it("refuses a password shorter than the realm policy", () => {
		expect(draftRejection({
			...validDraft,
			password: "a".repeat(MINIMUM_PASSWORD_LENGTH - 1)
		})).toBe(REGISTRATION_FAILURES.INVALID);
	});

	it("refuses an address that is not one", () => {
		expect(draftRejection({
			...validDraft,
			email: "pas-une-adresse"
		})).toBe(REGISTRATION_FAILURES.INVALID);
	});

	it("reserves the names the Discord bot owns", () => {
		expect(draftRejection({
			...validDraft,
			username: "discord-1234"
		})).toBe(REGISTRATION_FAILURES.TAKEN);
	});

	it("sends the draft trimmed, with the language of the app", async () => {
		jest.mocked(RestApi.register).mockResolvedValue(200);

		await registerAccount({
			...validDraft,
			username: "  Aventurier  ",
			email: "  joueur@example.com "
		});

		expect(RestApi.register).toHaveBeenCalledWith({
			username: "Aventurier",
			email: "joueur@example.com",
			password: validDraft.password,
			language: "fr"
		});
	});

	it.each([
		[409, REGISTRATION_FAILURES.TAKEN],
		[400, REGISTRATION_FAILURES.INVALID],
		[503, REGISTRATION_FAILURES.MAIL_UNAVAILABLE],
		[403, REGISTRATION_FAILURES.CLOSED],
		[500, REGISTRATION_FAILURES.UNKNOWN]
	])("turns status %i into a reason the player can read", async (status, reason) => {
		jest.mocked(RestApi.register).mockResolvedValue(status);

		await expect(registerAccount(validDraft)).rejects.toMatchObject({reason});
	});

	it("reports an unreachable server rather than a failed creation", async () => {
		jest.mocked(RestApi.register).mockRejectedValue(new TypeError("Network request failed"));

		await expect(registerAccount(validDraft)).rejects.toBeInstanceOf(RegistrationFailure);
		await expect(registerAccount(validDraft)).rejects.toMatchObject({reason: REGISTRATION_FAILURES.UNREACHABLE});
	});
});
