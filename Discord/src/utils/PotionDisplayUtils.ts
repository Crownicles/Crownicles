export function formatPotionUsagesPrefix(usages: number | undefined, maxUsages: number | undefined): string {
	if (!maxUsages || maxUsages <= 1) {
		return "";
	}
	return `**${usages ?? maxUsages}/${maxUsages}** | `;
}

