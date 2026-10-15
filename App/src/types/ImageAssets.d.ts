declare module "*.svg" {
	const source: number | import("expo-image").ImageSource;
	export default source;
}

declare module "*.png" {
	const source: number | import("expo-image").ImageSource;
	export default source;
}
