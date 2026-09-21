import {ReactNode, useState} from "react";
import {Modal} from "react-native";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {GENERIC_REACTION_KINDS, PET_FEED_DATA_KINDS, PET_FEED_REACTION_KINDS} from "ws-packets/src/fromServer/collectors";
import {OwnedPet} from "ws-packets/src/objects/OwnedPet";
import {PetFood} from "ws-packets/src/objects/PetFood";
import {countdownLabel, useSecondsLeft} from "@/src/collectors/CollectorPrompt";
import {useCollectorAnswer} from "@/src/collectors/useCollectorAnswer";
import {formatMoney} from "@/src/display/Amounts";
import {petIcon, petName} from "@/src/display/PetDisplay";
import {CircleAlert, Clock3, Utensils} from "@/src/design/FightIcons";
import {Note, Screen} from "@/src/design/Primitives";
import {ActionBanner, BackButton, ExpandableEntry, ExpandableList, Lock, LockHint, ModalSurface, Standing} from "@/src/design/Sections";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {AppIcons} from "@/src/AppIcons";
import {i18n} from "@/src/translations/i18n";

const FOOD_EMBLEM_SIZE = 26;
const PET_EMBLEM_SIZE = 34;

type PetFeedProps = {collector: ReactionCollectorCreation; onChoose: (index: number) => void; submitting: boolean};
/** The position in the collector is the answer, so every meal carries the index it was sent at. */
type FeedOption = {index: number; food: PetFood; caption: string; soldOut: boolean};

function feedOptions(collector: ReactionCollectorCreation): FeedOption[] {
	if (collector.data.type === PET_FEED_DATA_KINDS.PERSONAL) {
		const {food, price} = collector.data.data;
		const index = collector.reactions.findIndex(reaction => reaction.type === GENERIC_REACTION_KINDS.ACCEPT);
		return index < 0 ? [] : [{index, food, caption: formatMoney(price), soldOut: false}];
	}
	return collector.reactions.flatMap((reaction, index) => reaction.type === PET_FEED_REACTION_KINDS.FOOD
		? [{
			index,
			food: reaction.data.food,
			caption: i18n.t("app:pet.feed.storage", {amount: reaction.data.amount, max: reaction.data.maxAmount}),
			soldOut: reaction.data.amount === 0
		}]
		: []);
}

function foodName(food: PetFood): string {
	return i18n.t(`models:foods.${food}`, {count: 1, context: "capitalized"});
}

function FoodEmblem({food}: {food: PetFood}): ReactNode {
	const icon = AppIcons.getIconOrNull(`foods.${food}`);
	return icon ? <TwemojiIcon emoji={icon} size={FOOD_EMBLEM_SIZE} /> : null;
}

function feedLock(option: FeedOption, expired: boolean): Lock | null {
	if (expired) return {reason: i18n.t("app:collector.expired"), icon: Clock3};
	return option.soldOut ? {reason: i18n.t("app:pet.feed.errors.emptyStorage"), icon: CircleAlert} : null;
}

function FeedMenu({collector, pet, onChoose, submitting, onClose}: PetFeedProps & {pet: OwnedPet; onClose: () => void}): ReactNode {
	const options = feedOptions(collector);
	const [expanded, setExpanded] = useState<number | undefined>(options[0]?.index);
	const [answered, setAnswered] = useState(false);
	const secondsLeft = useSecondsLeft(collector.endTime);
	const pending = submitting || answered;
	const choose = (index: number): void => {
		setAnswered(true);
		onChoose(index);
	};
	return <Screen>
		<BackButton label={i18n.t("app:common.back")} onClose={onClose} />
		<Standing
			emblem={<TwemojiIcon emoji={petIcon(pet)} size={PET_EMBLEM_SIZE} />}
			caption={i18n.t("app:pet.eyebrow")}
			title={i18n.t("app:pet.care.feedPet", {pet: petName(pet)})}
		/>
		<ExpandableList>{options.map(option => {
			const lock = feedLock(option, secondsLeft === 0);
			const open = expanded === option.index;
			return <ExpandableEntry
				key={option.index}
				emblem={<FoodEmblem food={option.food} />}
				label={foodName(option.food)}
				caption={lock && !open ? <LockHint lock={lock} /> : option.caption}
				dimmed={Boolean(lock)}
				expanded={open}
				onToggle={(): void => setExpanded(previous => previous === option.index ? undefined : option.index)}
			>
				<ActionBanner
					icon={Utensils}
					label={i18n.t("app:pet.care.feed")}
					pending={pending}
					onPress={(): void => choose(option.index)}
					{...lock ? {lock} : {}}
				/>
			</ExpandableEntry>;
		})}</ExpandableList>
		<Note>{countdownLabel(secondsLeft, pending)}</Note>
	</Screen>;
}

export function PetFeedCollector(props: PetFeedProps): ReactNode {
	const {locked, answer} = useCollectorAnswer(props.collector, props.onChoose, props.submitting);
	const close = (): void => {
		const index = props.collector.reactions.findIndex(reaction => reaction.type === GENERIC_REACTION_KINDS.REFUSE);
		answer(index);
	};
	const data = props.collector.data;
	if (data.type !== PET_FEED_DATA_KINDS.GUILD && data.type !== PET_FEED_DATA_KINDS.PERSONAL) return null;
	return <Modal visible animationType="slide" onRequestClose={close}>
		<ModalSurface><FeedMenu {...props} pet={data.data.pet} onChoose={answer} submitting={locked} onClose={close} /></ModalSurface>
	</Modal>;
}
