/** Mirrors `Lib/src/types/PushDevices.ts`, kept in step by `WireEnums.test.ts`. */
export const PUSH_PLATFORMS = {
	IOS: "ios",
	ANDROID: "android"
} as const;

export type PushPlatform = typeof PUSH_PLATFORMS[keyof typeof PUSH_PLATFORMS];
