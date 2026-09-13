declare module "*.svg" {
	const source: number | import("expo-image").ImageSource;
	export default source;
}