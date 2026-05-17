export const GardenAccessMode = {
	FULL: "full",
	READ_ONLY: "readOnly"
} as const;

export type GardenAccessMode = typeof GardenAccessMode[keyof typeof GardenAccessMode];
