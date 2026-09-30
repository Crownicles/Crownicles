import {ReactNode, useState} from "react";
import {Text, View} from "react-native";
import {FightIntroduction, FightStatus} from "ws-packets/src/objects/Fight";
import {FightLogRecord} from "@/src/store/FightStore";
import {FIGHTER_GAP, FightEffects} from "@/src/components/FightEffects";
import {FightFighterCard} from "@/src/components/FightFighterCard";
import {useFightAnimation} from "@/src/store/useFightAnimation";
import {Theme} from "@/src/design/Theme";
import {i18n} from "@/src/translations/i18n";
import {useCompactFight} from "@/src/components/FightControls";
import {FightSpeed} from "@/src/display/FightMotion";
import {createStyles} from "@/src/design/ThemeContext";

const useStyles = createStyles(colors => ({
	stage: {position: "relative"},
	participants: {flexDirection: "row", alignItems: "flex-start", gap: FIGHTER_GAP},
	/** Level with the middle of the portraits, between the two cards. */
	versus: {position: "absolute", top: 57, left: "50%", marginLeft: -16, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", zIndex: 2},
	versusText: {fontFamily: Theme.fonts.extraBold, fontSize: 10, color: colors.faint},
	compactVersus: {top: 36}
}));

export function FightStage({status, introduction, record, onImpact, onComplete, reducedMotion, speed}: {status: FightStatus; introduction: FightIntroduction | null; record?: FightLogRecord; onImpact: () => void; onComplete: () => void; reducedMotion: boolean; speed: FightSpeed}): ReactNode {
	const styles = useStyles();
	const compact = useCompactFight();
	const [width, setWidth] = useState(350);
	const animation = useFightAnimation(record, {onImpact, onComplete}, reducedMotion, speed);
	const self = status.activeFighter.isSelf ? status.activeFighter : status.defendingFighter;
	const opponent = status.activeFighter.isSelf ? status.defendingFighter : status.activeFighter;
	return <View style={styles.stage} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
		<View style={styles.participants}><FightFighterCard fighter={self} pet={introduction?.initiatorPet} animation={animation} /><FightFighterCard fighter={opponent} pet={introduction?.opponentPet} animation={animation} /></View>
		<View style={[styles.versus, compact && styles.compactVersus]}><Text style={styles.versusText}>{i18n.t("app:battle.versus")}</Text></View>
		{animation.cue && !reducedMotion ? <FightEffects cue={animation.cue} progress={animation.progress} width={width} /> : null}
	</View>;
}