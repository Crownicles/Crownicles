import {clearTestQueryClients} from "./src/testing/testUtils";

// Tests render screens outside the app shell, where the real provider would have no window to measure.
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

// Screens are also rendered outside the router, where focus has no meaning: run the effect once.
jest.mock("expo-router", () => ({
	...jest.requireActual("expo-router"),
	useFocusEffect: (effect: () => void | (() => void)): void => require("react").useEffect(effect, [effect])
}));

afterEach((): void => {
	clearTestQueryClients();
});