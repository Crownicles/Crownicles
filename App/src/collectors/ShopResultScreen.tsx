import {
	ReactNode, useState
} from "react";
import { View } from "react-native";
import { ShopPetCheckupRes } from "ws-packets/src/fromServer/shop/ShopRes";
import { ShopResult } from "@/src/collectors/ReportEventStore";
import {
	Note, Screen, SectionHeader
} from "@/src/design/Primitives";
import {
	ActionBanner, Effects, EFFECT_TONES, ExpandableList, Fact, Figures, Gauge, Standing
} from "@/src/design/Sections";
import {
	BookOpen, Check, CircleAlert
} from "@/src/design/FightIcons";
import { Story } from "@/src/design/Story";
import { Theme } from "@/src/design/Theme";
import {
	createStyles, useColors
} from "@/src/design/ThemeContext";
import { MarketAnalysis } from "@/src/collectors/MarketAnalysis";
import {
	petIcon, petName
} from "@/src/display/PetDisplay";
import {
	ExpeditionAffinities, petCheckupSummary
} from "@/src/display/PetCheckup";
import { TwemojiIcon } from "@/src/design/TwemojiIcon";
import { formatNumber } from "@/src/display/Amounts";
import {
	isShopRefusal, shopOutcomeReport
} from "@/src/display/ShopReport";
import { i18n } from "@/src/translations/i18n";

const RESULT_EMBLEM_SIZE = 27;

const useStyles = createStyles(() => ({
	continue: { marginTop: Theme.spacing.xl },
	block: { marginTop: Theme.spacing.md },
	paragraphs: { gap: Theme.spacing.md }
}));

function ContinueBanner({ onContinue }: { onContinue: () => void }): ReactNode {
	const styles = useStyles();
	return <View style={styles.continue}><ActionBanner icon={BookOpen} label={i18n.t("app:city.checkup.continue")} onPress={onContinue} /></View>;
}

/** Where the pet thrives and what it distrusts, or how it adapts to every terrain. */
function CheckupAffinities({ affinities }: { affinities: ExpeditionAffinities }): ReactNode {
	if (!affinities.liked && !affinities.disliked) {
		return <Story>{i18n.t("app:city.checkup.noPreferences")}</Story>;
	}
	return <ExpandableList>
		{affinities.liked ? <Fact label={i18n.t("app:city.checkup.labels.liked")} value={affinities.liked} /> : null}
		{affinities.disliked ? <Fact label={i18n.t("app:city.checkup.labels.disliked")} value={affinities.disliked} /> : null}
	</ExpandableList>;
}

function CheckupReport({ packet }: { packet: ShopPetCheckupRes }): ReactNode {
	const styles = useStyles();
	const colors = useColors();
	const summary = petCheckupSummary(packet);
	return (
		<>
			<SectionHeader>{i18n.t("app:city.checkup.headers.diagnosis")}</SectionHeader>
			<View style={styles.paragraphs}>
				<Story>{summary.advice}</Story>
				<Story>{summary.ageComment}</Story>
			</View>

			<SectionHeader>{i18n.t("app:city.checkup.headers.vitals")}</SectionHeader>
			<ExpandableList>
				<Gauge
					label={i18n.t("app:city.checkup.labels.lovePoints")}
					value={i18n.t("app:profile.formats.progress", {
						value: summary.lovePoints.actual, max: summary.lovePoints.max
					})}
					ratio={summary.lovePoints.max > 0 ? summary.lovePoints.actual / summary.lovePoints.max : 0}
					color={colors.red}
				/>
			</ExpandableList>
			{summary.lovePointsGained > 0 && (
				<View style={styles.block}>
					<Effects items={[
						{
							label: i18n.t("app:city.checkup.labels.lovePointsGained"),
							value: formatNumber(summary.lovePointsGained),
							tone: EFFECT_TONES.GAIN
						}
					]}
					/>
				</View>
			)}
			<Figures items={[
				{
					caption: i18n.t("app:city.checkup.labels.force"), value: formatNumber(summary.force)
				},
				{
					caption: i18n.t("app:city.checkup.labels.speed"), value: formatNumber(summary.speed)
				}
			]}
			/>

			<SectionHeader>{i18n.t("app:city.checkup.headers.feeding")}</SectionHeader>
			<ExpandableList>
				<Fact label={i18n.t("app:city.checkup.labels.diet")} value={summary.diet} />
				<Fact label={i18n.t("app:city.checkup.labels.feedInterval")} value={summary.feedInterval} />
				<Fact label={i18n.t("app:city.checkup.labels.appetite")} value={summary.appetite} />
			</ExpandableList>

			<SectionHeader>{i18n.t("app:city.checkup.headers.combat")}</SectionHeader>
			<View style={styles.paragraphs}>{summary.fightEffects.map(effect => <Story key={effect}>{effect}</Story>)}</View>

			<SectionHeader>{i18n.t("app:city.checkup.headers.expeditions")}</SectionHeader>
			<CheckupAffinities affinities={summary.expeditions} />
			{summary.dwarfAside !== "" && (
				<>
					<SectionHeader>{i18n.t("app:city.checkup.headers.dwarf")}</SectionHeader>
					<Story>{summary.dwarfAside}</Story>
				</>
			)}
		</>
	);
}

/** What the commerce answers once the player has picked something, told in its own words. */
export function ShopResultScreen({
	result, onContinue
}: {
	result: ShopResult;
	onContinue: () => void;
}): ReactNode {
	const [now] = useState(() => Date.now());
	const colors = useColors();

	if (result.kind === "noPet") {
		return (
			<Screen>
				<Standing caption={i18n.t("app:city.checkup.eyebrow")} title={i18n.t("app:city.checkup.noPet")} />
				<Note>{i18n.t("app:city.checkup.noPetDescription")}</Note>
				<ContinueBanner onContinue={onContinue} />
			</Screen>
		);
	}
	if (result.kind === "checkup") {
		return (
			<Screen>
				<Standing emblem={<TwemojiIcon emoji={petIcon(result.packet)} size={RESULT_EMBLEM_SIZE} />} caption={i18n.t("app:city.checkup.eyebrow")} title={petName(result.packet)} />
				<CheckupReport packet={result.packet} />
				<ContinueBanner onContinue={onContinue} />
			</Screen>
		);
	}
	const refused = isShopRefusal(result.outcome);
	return (
		<Screen>
			<Standing
				emblem={refused ? <CircleAlert size={RESULT_EMBLEM_SIZE} color={colors.red} /> : <Check size={RESULT_EMBLEM_SIZE} color={colors.green} />}
				caption={i18n.t("app:city.shop.result.eyebrow")}
				title={i18n.t(refused ? "app:city.shop.result.refused" : "app:city.shop.result.done")}
			/>
			{result.outcome.kind === "marketAnalysis"
				? <MarketAnalysis outcome={result.outcome} />
				: <Story>{shopOutcomeReport(result.outcome, now)}</Story>}
			<ContinueBanner onContinue={onContinue} />
		</Screen>
	);
}
