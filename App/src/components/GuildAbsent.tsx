import {ReactNode, useState} from "react";
import {View} from "react-native";
import {useRouter} from "expo-router";
import {gameRules} from "@/src/rules/GameRules";
import {GuildCreation} from "@/src/components/Guild";
import {GuildBannerEmblem} from "@/src/components/GuildBanner";
import {Button, ButtonRow} from "@/src/design/Primitives";
import {ActionBanner, Lock} from "@/src/design/Sections";
import {FAREWELL_TONES, FarewellPage, FarewellTip, FarewellTips} from "@/src/design/Farewell";
import {Coins, Flag, Gift, PawPrint, Shield, UserPlus} from "@/src/design/FightIcons";
import {formatMoney} from "@/src/display/Amounts";
import {usePlayerProfile} from "@/src/store/usePlayerProfile";
import {i18n} from "@/src/translations/i18n";
import {createStyles, useColors} from "@/src/design/ThemeContext";

const useStyles = createStyles(() => ({
	actions: {gap: 12}
}));

function perks(): FarewellTip[] {
	return [
		{icon: Gift, text: i18n.t("app:guild.absent.dailyBonus"), tone: FAREWELL_TONES.GAIN},
		{icon: Shield, text: i18n.t("app:guild.absent.domain"), tone: FAREWELL_TONES.GAIN},
		{icon: PawPrint, text: i18n.t("app:guild.absent.shelter"), tone: FAREWELL_TONES.GAIN}
	];
}

function creationLock(money: number | undefined, price: number): Lock | undefined {
	if (money === undefined || money >= price) return undefined;
	return {reason: i18n.t("app:city.locks.missingMoney", {amount: formatMoney(price - money)}), icon: Coins};
}

/** No guild yet: what one brings, then founding one or looking for one to join. */
export function GuildAbsent(): ReactNode {
	const styles = useStyles();
	const colors = useColors();
	const router = useRouter();
	const profile = usePlayerProfile();
	const [creating, setCreating] = useState(false);
	const price = gameRules().guild.creationPrice;
	const lock = creationLock(profile.status === "ready" ? profile.data.money : undefined, price);
	return <>
		<FarewellPage
			emblem={<GuildBannerEmblem />}
			eyebrow={i18n.t("app:guild.eyebrow")}
			eyebrowColor={colors.gold}
			title={i18n.t("app:guild.absent.title")}
			description={i18n.t("app:guild.absent.description")}
		/>
		<FarewellTips title={i18n.t("app:guild.absent.perks")} tips={perks()} />
		<View style={styles.actions}>
			<ActionBanner
				icon={Flag}
				label={i18n.t("app:guild.absent.createWithCost", {price: formatMoney(price)})}
				onPress={(): void => setCreating(true)}
				{...lock ? {lock} : {}}
			/>
			{creating ? <GuildCreation /> : null}
			<ButtonRow><Button icon={UserPlus} onPress={(): void => router.push("/guild/join")}>{i18n.t("app:guild.absent.join")}</Button></ButtonRow>
		</View>
	</>;
}
