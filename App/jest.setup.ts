import {clearTestQueryClients} from "./src/testing/testUtils";

// Tests render screens outside the app shell, where the real provider would have no window to measure.
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

// Screens are also rendered outside the router, where focus has no meaning: run the effect once.
jest.mock("expo-router", () => ({
	...jest.requireActual("expo-router"),
	useFocusEffect: (effect: () => void | (() => void)): void => require("react").useEffect(effect, [effect])
}));

// Reanimated drives its values from a native worklet runtime the test environment does not have.
jest.mock("react-native-reanimated", () => {
	const {View} = require("react-native");
	return {
		__esModule: true,
		default: {
			View,
			createAnimatedComponent: (component: unknown) => component
		},
		useSharedValue: (value: unknown) => ({value}),
		useAnimatedStyle: (style: () => object) => style(),
		withTiming: (value: unknown) => value
	};
});

afterEach((): void => {
	clearTestQueryClients();
});