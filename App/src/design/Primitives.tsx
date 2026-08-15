import {ReactNode} from "react";
import {StyleSheet, Text, View} from "react-native";
import {Theme} from "@/src/design/Theme";

/**
 * Building blocks of `App/mockups/mobile.html`: a bordered card, key/value rows, section headers,
 * a progress bar and a footnote.
 */

export function Hero({ eyebrow, title, subtitle }: {
	eyebrow: string; title: string; subtitle?: string;
}): ReactNode {
	return (
		<View style={styles.hero}>
			<Text style={styles.eyebrow}>{eyebrow}</Text>
			<Text style={styles.heroTitle}>{title}</Text>
			{subtitle ? <Text style={styles.heroSubtitle}>{subtitle}</Text> : null}
		</View>
	);
}

export function SectionHeader({ children }: { children: string }): ReactNode {
	return <Text style={styles.sectionHeader}>{children}</Text>;
}

export function Panel({ children }: { children: ReactNode }): ReactNode {
	return <View style={styles.panel}>{children}</View>;
}

export function KeyValue({ label, value }: { label: string; value: string }): ReactNode {
	return (
		<View style={styles.keyValue}>
			<Text style={styles.keyValueLabel}>{label}</Text>
			<Text style={styles.keyValueValue} numberOfLines={2}>{value}</Text>
		</View>
	);
}

export function StatBar({ label, value, ratio, color }: {
	label: string; value: string; ratio: number; color: string;
}): ReactNode {
	return (
		<View style={styles.stat}>
			<View style={styles.statHead}>
				<Text style={styles.keyValueLabel}>{label}</Text>
				<Text style={styles.keyValueValue}>{value}</Text>
			</View>
			<View style={styles.track}>
				<View style={[styles.fill, {
					width: `${Math.min(100, Math.max(0, ratio * 100))}%`, backgroundColor: color
				}]} />
			</View>
		</View>
	);
}

export function Note({ children }: { children: string }): ReactNode {
	return <Text style={styles.note}>{children}</Text>;
}

const styles = StyleSheet.create({
	hero: { marginBottom: Theme.spacing.xl },
	eyebrow: {
		color: Theme.colors.faint, fontSize: Theme.fontSize.note, textTransform: "uppercase", letterSpacing: 1
	},
	heroTitle: {
		color: Theme.colors.ink, fontSize: Theme.fontSize.hero, fontWeight: "700", marginTop: Theme.spacing.xs
	},
	heroSubtitle: {
		color: Theme.colors.muted, fontSize: Theme.fontSize.body, marginTop: Theme.spacing.xs
	},
	sectionHeader: {
		color: Theme.colors.ink, fontSize: Theme.fontSize.label, fontWeight: "600", marginBottom: Theme.spacing.sm, marginTop: Theme.spacing.xl
	},
	panel: {
		borderWidth: 1, borderColor: Theme.colors.line, borderRadius: Theme.radius, overflow: "hidden", backgroundColor: Theme.colors.paper
	},
	keyValue: {
		flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: Theme.spacing.md, paddingVertical: 10, paddingHorizontal: Theme.spacing.lg, borderTopWidth: 1, borderTopColor: Theme.colors.line
	},
	keyValueLabel: { color: Theme.colors.muted, fontSize: Theme.fontSize.body },
	keyValueValue: {
		color: Theme.colors.ink, fontSize: Theme.fontSize.body, flexShrink: 1, textAlign: "right"
	},
	stat: {
		paddingVertical: Theme.spacing.md, paddingHorizontal: Theme.spacing.lg, borderTopWidth: 1, borderTopColor: Theme.colors.line
	},
	statHead: {
		flexDirection: "row", justifyContent: "space-between", marginBottom: Theme.spacing.sm
	},
	track: {
		height: 6, borderRadius: 3, backgroundColor: Theme.colors.wash, overflow: "hidden"
	},
	fill: { height: "100%", borderRadius: 3 },
	note: {
		paddingVertical: 11, paddingHorizontal: Theme.spacing.lg, borderTopWidth: 1, borderTopColor: Theme.colors.line, fontSize: Theme.fontSize.note, color: Theme.colors.muted
	}
});
