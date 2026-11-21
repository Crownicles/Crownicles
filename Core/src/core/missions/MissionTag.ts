import {
	IMission, MissionParams
} from "./IMission";

export class MissionTag implements IMission {
	public tagNames!: string[];

	constructor(tagsToProc: string[]) {
		this.tagNames = tagsToProc;
	}

	areParamsMatchingVariantAndBlob(_variant: number, params: MissionParams): boolean {
		const tags = params.tags as string[];
		return this.tagNames.some(tag => tags.includes(tag));
	}

	generateRandomVariant(): number {
		return 0;
	}

	initialNumberDone(): number {
		return 0;
	}

	updateSaveBlob(): Buffer | null {
		return null;
	}
}
