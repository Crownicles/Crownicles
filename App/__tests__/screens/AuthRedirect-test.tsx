import { render } from "@testing-library/react-native";
import AuthRedirect from "@/app/auth";

const mockRouter = {
	canGoBack: jest.fn(), back: jest.fn(), replace: jest.fn()
};

jest.mock("expo-router", () => ({ useRouter: (): typeof mockRouter => mockRouter }));
jest.mock("expo-web-browser", () => ({ maybeCompleteAuthSession: jest.fn() }));

describe("sign-in redirect screen", () => {
	beforeEach(() => jest.clearAllMocks());

	it("gives the screen back to the one that started the sign-in", async () => {
		mockRouter.canGoBack.mockReturnValue(true);
		await render(<AuthRedirect />);
		expect(mockRouter.back).toHaveBeenCalledTimes(1);
		expect(mockRouter.replace).not.toHaveBeenCalled();
	});

	it("opens the app when the redirect is all there is", async () => {
		mockRouter.canGoBack.mockReturnValue(false);
		await render(<AuthRedirect />);
		expect(mockRouter.replace).toHaveBeenCalledWith("/");
		expect(mockRouter.back).not.toHaveBeenCalled();
	});
});
