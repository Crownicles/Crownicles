import {ReactNode} from "react";
import {StyleSheet, Text, View} from "react-native";
import {ProfileRes} from "ws-packets/src/fromServer/profile/ProfileRes";
import {AppIcons} from "@/src/AppIcons";
import {AMOUNT_UNITS, AmountUnit, formatNumber} from "@/src/display/Amounts";
import {Theme} from "@/src/design/Theme";
import {TwemojiText} from "@/src/design/TwemojiText";
import {usePlayerProfile} from "@/src/store/usePlayerProfile";
import {i18n} from "@/src/translations/i18n";

const FULL_RATIO = 1;

const styles = StyleSheet.create({
	band: {
		backgroundColor: Theme.colors.paper,
		borderBottomWidth: 1,
		borderBottomColor: Theme.colors.line,
		paddingTop: Theme.spacing.sm
	},
	vitals: {
		flexDirection: "row",
		alignItems: "center",
		gap: Theme.spacing.lg,
		paddingHorizontal: Theme.spacing.xl,
		paddingBottom: Theme.spacing.vitalsBottom
	},
	vital: {
		flex: 1,
		minWidth: 0
	},
	vitalHead: {
		flexDirection: "row",
		justifyContent: "space-between",
		gap: Theme.spacing.titleGap,
		marginBottom: Theme.spacing.xs
	},
	vitalLabel: {
		color: Theme.colors.muted,
		fontFamily: Theme.fonts.semiBold,
		fontSize: Theme.fontSize.vitalLabel,
		letterSpacing: Theme.letterSpacing.vitalLabel
	},
	vitalValue: {
		color: Theme.colors.ink,
		fontFamily: Theme.fonts.semiBold,
		fontSize: Theme.fontSize.vitalLabel,
		letterSpacing: Theme.letterSpacing.vitalLabel
	},
	track: {
		height: Theme.dimensions.vitalBarHeight,
		borderRadius: Theme.pillRadius,
		backgroundColor: Theme.colors.line,
		overflow: "hidden"
	},
	fill: {
		height: "100%",
		borderRadius: Theme.pillRadius
	},
	wallet: {
		flexDirection: "row",
		gap: Theme.spacing.titleGap,
		paddingHorizontal: Theme.spacing.xl,
		paddingBottom: Theme.spacing.walletBottom
	},
	chip: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: Theme.colors.wash,
		borderRadius: Theme.pillRadius,
		paddingVertical: Theme.spacing.chipVertical,
		paddingHorizontal: Theme.spacing.chipHorizontal
	},
	chipText: {
		color: Theme.colors.ink,
		fontFamily: Theme.fonts.bold,
		fontSize: Theme.fontSize.caption,
		letterSpacing: Theme.letterSpacing.chip
	}
});

function ratioOf(current: number, max: number): number {
	return max <= 0 ? FULL_RATIO : current / max;
}

function Vital({icon, label, current, max, color}: {
	icon: string;
	label: string;
	current: number;
	max: number;
	color: string;
}): ReactNode {
	return (
		<View style={styles.vital}>
			<View style={styles.vitalHead}>
				<TwemojiText textStyle={styles.vitalLabel} emojiSize={Theme.fontSize.vitalLabel}>{`${icon} ${label}`}</TwemojiText>
				<Text style={styles.vitalValue}>{`${formatNumber(current)} / ${formatNumber(max)}`}</Text>
			</View>
			<View style={styles.track}>
				<View style={[styles.fill, {
					width: `${Math.min(1, Math.max(0, ratioOf(current, max))) * 100}%`,
					backgroundColor: color
				}]} />
			</View>
		</View>
	);
}

function Chip({unit, value}: { unit: AmountUnit; value: number }): ReactNode {
	return (
		<View style={styles.chip}>
			<TwemojiText textStyle={styles.chipText} emojiSize={Theme.fontSize.caption}>
				{`${AppIcons.getIcon(`unitValues.${unit}`)} ${formatNumber(value)}`}
			</TwemojiText>
		</View>
	);
}

function VitalsBand({profile}: { profile: ProfileRes }): ReactNode {
	const energy = profile.stats?.energy;
	return (
		<View style={styles.band}>
			<View style={styles.vitals}>
				<Vital
					icon={AppIcons.getIcon("unitValues.health")}
					label={i18n.t("app:vitals.health")}
					current={profile.health.value}
					max={profile.health.max}
					color={Theme.colors.red}
				/>
				{energy ? (
					<Vital
						icon={AppIcons.getIcon("unitValues.energy")}
						label={i18n.t("app:vitals.energy")}
						current={energy.value}
						max={energy.max}
						color={Theme.colors.green}
					/>
				) : null}
			</View>
			<View style={styles.wallet}>
				<Chip unit={AMOUNT_UNITS.MONEY} value={profile.money} />
				<Chip unit={AMOUNT_UNITS.GEM} value={profile.missions.gems} />
				{profile.tokens ? <Chip unit={AMOUNT_UNITS.TOKEN} value={profile.tokens.value} /> : null}
			</View>
		</View>
	);
}

/**
 * Health, energy and purse, kept above the adventure content like in `mobile.html`.
 *
 * Reads the shared profile rather than taking values from the screen below it: the same numbers
 * are shown whichever adventure state is on screen, and a resolved action refreshes both at once.
 */
export function PlayerVitals(): ReactNode {
	const state = usePlayerProfile();
	return state.status === "ready" ? <VitalsBand profile={state.data} /> : null;
}
