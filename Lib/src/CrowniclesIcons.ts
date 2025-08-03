import { Badge } from "./types/Badge";

type EventPossibilities = {
	end: { [outcomeId: string]: string };
} & Record<string, string | { [outcomeId: string]: string }>;

export const CrowniclesIcons: {
	effects: {
		[effectId: string]: string;
	};
	events: {
		[eventId: string]: EventPossibilities;
	};
	mapTypes: {
		[mapType: string]: string;
	};
	smallEvents: {
		[smallEventId: string]: string;
	};
	pets: {
		[petId: string]: {
			emoteFemale: string;
			emoteMale: string;
		};
	};
	monsters: {
		[monsterId: string]: string;
	};
	armors: {
		[itemId: string]: string;
	};
	weapons: {
		[itemId: string]: string;
	};
	potions: {
		[itemId: string]: string;
	};
	objects: {
		[itemId: string]: string;
	};
	classes: {
		[classId: string]: string;
	};
	witchSmallEvent: {
		[ingredient: string]: string;
	};
	cartSmallEvent: {
		accept: string;
		refuse: string;
	};
	infoFightSmallEvent: {
		showHandednessInfo: string;
	};
	fightCommand: {
		accept: string;
		aiThinking: string;
		clipboard: string;
		crossedSwords: string;
		shield: string;
		fighterStats: string;
		gameStats: string;
		gloryChange: string;
		handshake: string;
		refuse: string;
	};
	clocks: {
		[clockId: string]: string;
	};
	pveFights: {
		waitABit: string;
		startFight: string;
	};
	foods: {
		[foodId: string]: string;
	};
	collectors: {
		accept: string;
		refuse: string;
		lottery: {
			easy: string;
			medium: string;
			hard: string;
		};
		interactPoorCoin: string;
		warning: string;
		question: string;
		back: string;
		switch: string;
		previousPage: string;
		nextPage: string;
	};
	fightActions: {
		[actionId: string]: string;
	};
	classKinds: {
		[classKind: string]: string;
	};
	announcements: {
		trophy: string;
	};
	commands: {
		[commandId: string]: string;
	};
	unitValues: {
		[unitValueId: string]: string;
	};
	shopItems: {
		[shopItemId: string]: string;
	};
	badges: {
		[badgeId in Badge]: string;
	};
	itemKinds: string[];
	notifications: {
		bell: string;
		sendLocation: string;
		back: string;
		types: { [notificationId: string]: string };
	};
	missions: {
		[missionId: string]: string;
	};
	messages: {
		validate: string;
		refuse: string;
		notReplied: string;
		dm: string;
		description: string;
		item: string;
		info: string;
	};
	fightPetActions: {
		[actionId: string]: string;
	};
	rewards: {
		[rewardId: string]: string;
	};
	goblets: {
		[gobletId: string]: string;
	};
	sex: {
		male: string;
		female: string;
	};
	diet: {
		[dietId: string]: string;
	};
	petInformation: {
		[petInfoId: string]: string;
	};
	petCommand: {
		petButton: string;
		pet: string;
	};
	leagues: {
		[leagueId: string]: string;
	};
	top: {
		badges: {
			first: string;
			second: string;
			third: string;
			fourth: string;
			fifth: string;
			self: string;
			sameContext: string;
			default: string;
		};
		afk: string;
		allTime: string;
		weekly: string;
		congrats: string;
		error: string;
		guild: string;
	};
	petTransfer: {
		deposit: string;
		switch: string;
		withdraw: string;
	};
	other: {
		[otherId: string]: string;
	};
	guild: {
		icon: string;
		chief: string;
		elder: string;
		member: string;
		isOnPveIsland: string;
		isOnBoat: string;
		countAsAnAlly: string;
		cannotBeJoinedOnBoat: string;
		membersCount: string;
	};
	networks: {
		website: string;
		discord: string;
	};
	languages: {
		[languageId: string]: string;
	};
	languageFlavors: {
		[languageFlavorId: string]: string;
	};
	rarity: string[];
	loveLevels: string[];
	userKind: {
		[UserKindId: string]: string;
	};
	inventory: {
		[inventoryId: string]: string;
	};
	itemNatures: string[];
	itemCategories: string[];
	profile: {
		displayAllBadgeEmote: string;
	};
	fightHistory: {
		won: string;
		lost: string;
		draw: string;
	};
} = {
	effects: {
		notStarted: "👶",
		dead: "💀",
		none: "😃",
		sleeping: "😴",
		drunk: "🤪",
		freezing: "🥶",
		feetHurt: "🦶",
		hurt: "🤕",
		sick: "🤢",
		jailed: "🔒",
		injured: "😵",
		occupied: "🕑",
		starving: "🤤",
		confounded: "😖",
		scared: "😱",
		lost: "🧐",
		healed: "🏥",
		fished: "🐟",
		working: "👨‍🔧",
		burning: "🥵"
	},
	events: {
		1: {
			chopTree: "🪓",
			climbOver: "🧗",
			findPath: "🗺️",
			end: {
				0: "🪓"
			}
		},
		10: {
			end: {
				0: "🚶"
			},
			help: "🎣",
			advice: "🗣️",
			push: "🖐️",
			skip: "🏃"
		},
		11: {
			followHint: "🧭",
			questionStranger: "🕵️",
			forest: "🌲",
			oppositeSide: "🚶",
			end: {
				0: "🕑",
				1: "🕑"
			}
		},
		12: {
			useBridge: "🌉",
			crossRiver: "🏊",
			searchAlternative: "🚶",
			makeRaft: "🚣",
			end: {
				0: "🕑",
				1: "🕑"
			}
		},
		13: {
			end: {
				0: "🚶",
				1: "🚶"
			},
			visitForge: "🔨",
			visitInn: "🏠",
			exploreMarket: "🎪",
			seekInformation: "🕵️",
			helpCityGuards: "🛡️",
			restAndObserve: "🛏️"
		},
		14: {
			chatWorker: "🤝",
			stayNight: "🛏️",
			inspectForge: "🧐",
			goAway: "🚶",
			end: {
				0: "🌾"
			}
		},
		15: {
			end: {
				0: "🚶"
			},
			skip: "🏃",
			steal: "💰",
			trade: "👥"
		},
		16: {
			end: {
				0: "🚶",
				1: "🚶"
			},
			enterCastle: "🔎",
			skip: "➡️",
			walkAround: "🔁"
		},
		17: {
			end: {
				0: "🚶",
				1: "🚶"
			},
			fruits: "🍎",
			hunt: "🦌",
			mushrooms: "🍄",
			salad: "🥗",
			skip: "🚶"
		},
		18: {
			end: {
				0: "🚶"
			},
			searchScaffolding: "⛓️",
			searchSite: "🔎",
			skip: "🚶"
		},
		19: {
			butch: "🔪",
			cook: "🍽️",
			end: {
				0: "👀"
			},
			skip: "🚶"
		},
		2: {
			end: {
				0: "🐶"
			},
			followDog: "🐕",
			skip: "🏃"
		},
		20: {
			alert: "🤙",
			end: {
				0: "🚶",
				1: "🚶"
			},
			skip: "🚶",
			surpriseAttack: "👊"
		},
		21: {
			crossBridge: "🌉",
			end: {
				0: "🕑",
				1: "🚶"
			},
			otherWay: "🚶"
		},
		22: {
			buy: "💶",
			end: {
				0: "👀",
				1: "👀"
			},
			skip: "🏃",
			steal: "👥"
		},
		23: {
			end: {
				0: "👀"
			},
			help: "🔨",
			skip: "🚶"
		},
		24: {
			end: {
				0: "🚶",
				1: "🚶"
			},
			foodStand: "🍢",
			gameStand: "🎯",
			itemStand: "🎪"
		},
		25: {
			dontHelp: "🚶",
			end: {
				0: "👀",
				1: "👀"
			},
			help: "🤝",
			steal: "🕵️"
		},
		26: {
			end: {
				0: "👀"
			},
			goAway: "🚶",
			steal: "💸",
			trySave: "👊"
		},
		27: {
			end: {
				0: "👀",
				1: "👀"
			},
			goDown: "👇",
			skip: "🚶",
			useBucket: "🤝"
		},
		28: {
			accept: "✅",
			deny: "❌",
			end: {
				0: "🚶"
			}
		},
		29: {
			end: {
				0: "👀",
				1: "🚶"
			},
			restHere: "😴",
			restTree: "🌳",
			searchWater: "🔍"
		},
		3: {
			abandon: "▶️",
			end: {
				0: "▶️"
			},
			mineIt: "⛏️",
			searchKey: "🔑"
		},
		30: {
			duke: "🤴",
			end: {
				0: "🚶",
				1: "🚶"
			},
			gift: "🎁",
			party: "🎉",
			steal: "🍌"
		},
		31: {
			end: {
				0: "🚶"
			},
			hide: "🌿",
			keepGoing: "🚶",
			wave: "👋"
		},
		32: {
			end: {
				0: "🚶",
				1: "🚶",
				2: "🚶",
				3: "🚶"
			},
			heal: "💉",
			kill: "🔪",
			yell: "🗣️"
		},
		33: {
			chat: "👄",
			eat: "🍗",
			end: {
				0: "🐐",
				1: "🫕"
			},
			skip: "🚶",
			steal: "🕵️"
		},
		34: {
			end: {
				0: "🚶",
				1: "🚶‍",
				2: "🚶‍"
			},
			food: "🥗",
			health: "😇",
			kind: "🍀",
			money: "💰"
		},
		35: {
			deny: "❌",
			end: {
				0: "🚶"
			},
			steal: "💰",
			test: "🍺"
		},
		36: {
			end: {
				0: "🚶‍",
				1: "🚶"
			},
			goAway: "🚶",
			goInn: "🏡",
			stealJeweler: "💸",
			talkJeweler: "🗣️"
		},
		37: {
			end: {
				0: "🌳",
				1: "🌳"
			},
			run: "🏃",
			walk: "🚶"
		},
		38: {
			buyCheap: "💸",
			buyExpensive: "💰",
			deny: "❌",
			end: {
				0: "🚶",
				1: "👥",
				2: "👥"
			},
			steal: "🕵️"
		},
		39: {
			convoy: "🚶",
			end: {
				0: "🗣️",
				1: "🗣️"
			},
			meal: "🍖",
			steal: "🤑"
		},
		4: {
			end: {
				0: "🏃"
			},
			skip: "🏃",
			wish: "🗣️"
		},
		40: {
			askAdvices: "🗣️",
			breakIn: "🔎",
			end: {
				0: "🚶",
				1: "🚶"
			},
			goBack: "🚶"
		},
		41: {
			corrupt: "🕵️",
			end: {
				0: "🗣️",
				1: "🕑",
				2: "🚶"
			},
			escape: "🔓",
			explain: "🗣️",
			playDead: "💀",
			wait: "🕑"
		},
		42: {
			ask: "🥩",
			end: {
				0: "🚶",
				1: "🚶"
			},
			feign: "😎",
			help: "🏹"
		},
		43: {
			continue: "⬆️",
			end: {
				0: "🚶",
				1: "🚶",
				2: "🚶"
			},
			fight: "⚔️",
			goBack: "⬇️",
			shelter: "⛪"
		},
		44: {
			end: {
				0: "🚶"
			},
			help: "🦸",
			push: "😈",
			watch: "😐"
		},
		45: {
			askJoin: "⤴️",
			end: {
				0: "🕵️",
				1: "🚶"
			},
			goAlone: "🚶",
			skip: "▶️",
			talk: "🔊"
		},
		46: {
			end: {
				0: "🚶",
				1: "🔪",
				2: "💊"
			},
			singCrazyLove: "🤪",
			singHero: "⚔️",
			singLove: "🥰",
			singRoyalty: "👑",
			singWork: "🪕"
		},
		47: {
			end: {
				0: "🚶",
				1: "🏃",
				2: "🕵️"
			},
			goAway: "🚶",
			help: "⚔",
			tell: "🗣️"
		},
		48: {
			end: {
				0: "🚶",
				1: "🤔",
				2: "🌌",
				3: "🫂",
				4: "😕"
			},
			fight: "⚔️",
			meetHim: "🤝"
		},
		49: {
			eatIt: "🍖",
			end: {
				0: "🐚",
				1: "🐚",
				2: "🐚"
			},
			helpIt: "🤝",
			takeIt: "💞"
		},
		5: {
			end: {
				0: "🤑"
			},
			keepGoing: "🚶",
			rest: "💦"
		},
		50: {
			ask: "🗣️",
			end: {
				0: "Vous",
				1: "L'un"
			},
			leave: "🚶",
			nap: "😴"
		},
		51: {
			end: {
				0: "😴",
				1: "💥",
				2: "🦊"
			},
			goBack: "🚶‍♂️",
			search: "🔎",
			stairs: "↗️"
		},
		52: {
			deny: "❌",
			end: {
				0: "🚶",
				1: "👞",
				2: "💸"
			},
			play: "👥",
			playFight: "⚔️",
			teach: "🏹"
		},
		53: {
			accept: "✅",
			deny: "❌",
			end: {
				0: "😶",
				1: "🚶",
				2: "🚶"
			},
			steal: "🕵️"
		},
		54: {
			bet: "🪙",
			end: {
				0: "🗣",
				1: "😵‍💫",
				2: "🚶",
				3: "🪙",
				4: "🍖"
			},
			help: "🤝",
			look: "👥",
			visit: "🚶"
		},
		55: {
			climb: "🧗",
			cut: "🪓",
			end: {
				0: "🤷",
				1: "🤷",
				2: "👥"
			},
			otherWay: "🚶"
		},
		56: {
			beach: "🏖",
			drinkBlack: "⚫",
			drinkRandom: "🍸",
			end: {
				0: "💥",
				1: "😶",
				2: "🍵"
			},
			refuse: "❌"
		},
		57: {
			continue: "🌊",
			end: {
				0: "Vous",
				1: "Vous",
				2: "Vous"
			},
			findMeal: "🦀",
			settle: "🌞"
		},
		58: {
			continue: "🚶",
			end: {
				0: "Vous",
				1: "Épuisé,"
			},
			goAlchemist: "🍵",
			shortcut: "🏃"
		},
		6: {
			end: {
				0: "🕑"
			},
			goAway: "🏃",
			goDeeper: "🔦",
			search: "🔍"
		},
		60: {
			end: {
				0: "Vous"
			},
			start: "📖"
		},
		61: {
			end: {
				0: "Vous"
			},
			follow: "🚶",
			observe: "👀"
		},
		62: {
			deny: "✖️",
			end: {
				0: "🥓",
				1: "🐕",
				2: "🐝"
			},
			searchPatures: "🍀",
			searchVines: "🍇",
			searchWheat: "🎑"
		},
		63: {
			end: {
				0: "🎆",
				1: "🍺",
				2: "🗯️",
				3: "💡"
			},
			faceThem: "⚔️",
			goAway: "🏃",
			helpThem: "😈",
			warnEveryone: "🔊"
		},
		64: {
			accept: "🏰",
			deny: "❌",
			end: {
				0: "🤔"
			}
		},
		65: {
			end: {
				0: "💰",
				1: "❤️",
				2: "💎",
				3: "⭐",
				4: "🏅",
				5: "⚔️",
				6: "🛡️",
				7: "📦"
			},
			hopeArmor: "🛡️",
			hopeGems: "💎",
			hopeGlory: "🏅",
			hopeHealthy: "❤️",
			hopeItem: "📦",
			hopeMoney: "💰",
			hopePet: "🐕‍🦺",
			hopeWeapon: "⚔️",
			hopeXP: "⭐"
		},
		66: {
			end: {
				0: "😖",
				1: "😖"
			},
			hints: "ℹ️",
			run: "🏝️"
		},
		67: {
			accept: "🍺",
			deny: "✋",
			end: {
				0: "🥱"
			}
		},
		68: {
			checkDate: "🗓️",
			end: {
				0: "🚶‍",
				1: "👀",
				2: "📓‍"
			},
			read: "📖",
			steal: "📔"
		},
		69: {
			accept: "👍",
			compromise: "🤝",
			deny: "👿",
			end: {
				0: "👁️"
			}
		},
		7: {
			check: "🚪",
			end: {
				0: "🚶"
			},
			skip: "🚶"
		},
		70: {
			end: {
				0: "💤",
				1: "🌪️",
				2: "🏹"
			},
			explore: "🔍",
			skip: "🚶"
		},
		71: {
			accept: "🍖",
			deny: "❌",
			end: {
				0: "🏃",
				1: "😠"
			},
			steal: "💸"
		},
		72: {
			end: {
				0: "🗣️",
				1: "🧠"
			},
			joinArchery: "🎯",
			joinJoust: "🐴",
			joinMelee: "⚔️",
			joinPoetry: "📜",
			searchFood: "🍴"
		},
		73: {
			end: {
				0: "👤",
				1: "🖌️",
				2: "💼"
			},
			goAway: "🚶‍♂️",
			look: "👀",
			shame: "🗯"
		},
		74: {
			end: {
				0: "🐟"
			},
			eat: "🍽️",
			run: "🏃",
			smell: "👃"
		},
		75: {
			accept: "⚓",
			refuse: "⛔",
			end: {
				0: "🏝️",
				1: "🏝️",
				2: "🏝️",
				3: "🏏"
			}
		},
		76: {
			end: {
				0: "🚶‍♂️"
			},
			help: "🤝",
			explore: "🔍",
			question: "❓"
		},
		77: {
			end: {
				0: "🌲"
			},
			approach: "👋",
			hide: "👁️",
			flee: "🏃‍♂️"
		},
		78: {
			end: {
				0: "⏳"
			},
			prudent: "🚶‍♂️",
			wait: "⏸️",
			call: "📢",
			goDown: "⬇️"
		},
		79: {
			end: {
				0: "👀"
			},
			follow: "🐐",
			overtake: "🏃‍♂️",
			ask: "❓",
			stepAside: "👋",
			help: "🤝"
		},
		8: {
			end: {
				0: "🚶"
			},
			forest: "🌲",
			plains: "🏞️"
		},
		9: {
			end: {
				0: "🚶"
			},
			help: "🔎",
			skip: "▶️"
		}
	},
	mapTypes: {
		be: "🏖",
		castleEntrance: "🏰",
		castleThrone: "🪑",
		ci: "🏘",
		continent: "🏞",
		crystalCavern: "💎",
		de: "🏜",
		fo: "🌳",
		iceBeach: "🌨",
		la: "🚣‍♂",
		mine: "🪨",
		mo: "⛰",
		pl: "🌺",
		pveExit: "⛴",
		ri: "🏞",
		ro: "🛣",
		ruins: "🏚",
		testZone: "👾",
		tundra: "🌲",
		vi: "🛖",
		volcano: "🌋",
		icePeak: "🏔",
		blessedDoors: "⛩️",
		undergroundLake: "💧",
		dragonsNest: "🪹"
	},
	smallEvents: {
		advanceTime: "⌛",
		bigBad: "😱",
		boatAdvice: "⛴️",
		bonusGuildPVEIsland: "😱",
		botFacts: "💮",
		botVote: "🗳️",
		cart: "🚗",
		class: "🔖",
		doNothing: "🚶",
		dwarfPetFan: "⛏️",
		epicItemShop: "🌟",
		fightPet: "😾",
		findItem: "❕",
		findMission: "📜",
		findPet: "🐕",
		findPotion: "⚗️",
		goToPVEIsland: "⛴️",
		gobletsGame: "🥛",
		interactOtherPlayers: "💬",
		leagueReward: "✨",
		lottery: "🎰",
		pet: "🐕‍🦺",
		shop: "🛒",
		smallBad: "😖",
		space: "🪐",
		staffMember: "📖",
		ultimateFoodMerchant: "🍲",
		winEnergy: "⚡",
		winEnergyOnIsland: "🔋",
		winGuildXP: "⭐",
		winHealth: "❤️",
		winPersonalXP: "⭐",
		witch: "🧹",
		infoFight: "🏰"
	},
	pets: {
		0: {
			emoteFemale: "❌",
			emoteMale: "❌"
		},
		1: {
			emoteFemale: "🐕",
			emoteMale: "🐕"
		},
		10: {
			emoteFemale: "🐔",
			emoteMale: "🐓"
		},
		11: {
			emoteFemale: "🐦",
			emoteMale: "🐦"
		},
		12: {
			emoteFemale: "🦆",
			emoteMale: "🦆"
		},
		13: {
			emoteFemale: "🐎",
			emoteMale: "🐎"
		},
		14: {
			emoteFemale: "🐢",
			emoteMale: "🐢"
		},
		15: {
			emoteFemale: "🐍",
			emoteMale: "🐍"
		},
		16: {
			emoteFemale: "🦎",
			emoteMale: "🦎"
		},
		17: {
			emoteFemale: "🐑",
			emoteMale: "🐏"
		},
		18: {
			emoteFemale: "🐐",
			emoteMale: "🐐"
		},
		19: {
			emoteFemale: "🦃",
			emoteMale: "🦃"
		},
		2: {
			emoteFemale: "🐩",
			emoteMale: "🐩"
		},
		20: {
			emoteFemale: "🦊",
			emoteMale: "🦊"
		},
		21: {
			emoteFemale: "🐻",
			emoteMale: "🐻"
		},
		22: {
			emoteFemale: "🐨",
			emoteMale: "🐨"
		},
		23: {
			emoteFemale: "🐸",
			emoteMale: "🐸"
		},
		24: {
			emoteFemale: "🐒",
			emoteMale: "🐒"
		},
		25: {
			emoteFemale: "🐧",
			emoteMale: "🐧"
		},
		26: {
			emoteFemale: "🦉",
			emoteMale: "🦉"
		},
		27: {
			emoteFemale: "🦇",
			emoteMale: "🦇"
		},
		28: {
			emoteFemale: "🐺",
			emoteMale: "🐺"
		},
		29: {
			emoteFemale: "🐗",
			emoteMale: "🐗"
		},
		3: {
			emoteFemale: "🐈",
			emoteMale: "🐈"
		},
		30: {
			emoteFemale: "🦭",
			emoteMale: "🦭"
		},
		31: {
			emoteFemale: "🦛",
			emoteMale: "🦛"
		},
		32: {
			emoteFemale: "🦙",
			emoteMale: "🦙"
		},
		33: {
			emoteFemale: "🦢",
			emoteMale: "🦢"
		},
		34: {
			emoteFemale: "🦩",
			emoteMale: "🦩"
		},
		35: {
			emoteFemale: "🦝",
			emoteMale: "🦝"
		},
		36: {
			emoteFemale: "🦨",
			emoteMale: "🦨"
		},
		37: {
			emoteFemale: "🦡",
			emoteMale: "🦡"
		},
		38: {
			emoteFemale: "🦫",
			emoteMale: "🦫"
		},
		39: {
			emoteFemale: "🦥",
			emoteMale: "🦥"
		},
		4: {
			emoteFemale: "🐈‍⬛",
			emoteMale: "🐈‍⬛"
		},
		40: {
			emoteFemale: "🐿️",
			emoteMale: "🐿️"
		},
		41: {
			emoteFemale: "🦔️",
			emoteMale: "🦔"
		},
		42: {
			emoteFemale: "🐻‍❄️",
			emoteMale: "🐻‍❄️"
		},
		43: {
			emoteFemale: "🐼",
			emoteMale: "🐼"
		},
		44: {
			emoteFemale: "🦂",
			emoteMale: "🦂"
		},
		45: {
			emoteFemale: "🐊",
			emoteMale: "🐊"
		},
		46: {
			emoteFemale: "🐘",
			emoteMale: "🐘"
		},
		47: {
			emoteFemale: "🦓",
			emoteMale: "🦓"
		},
		48: {
			emoteFemale: "🦏",
			emoteMale: "🦏"
		},
		49: {
			emoteFemale: "🐪",
			emoteMale: "🐪"
		},
		5: {
			emoteFemale: "🐁",
			emoteMale: "🐁"
		},
		50: {
			emoteFemale: "🐫",
			emoteMale: "🐫"
		},
		51: {
			emoteFemale: "🦒",
			emoteMale: "🦒"
		},
		52: {
			emoteFemale: "🦘",
			emoteMale: "🦘"
		},
		53: {
			emoteFemale: "🦚",
			emoteMale: "🦚"
		},
		54: {
			emoteFemale: "🦜",
			emoteMale: "🦜"
		},
		55: {
			emoteFemale: "🦦",
			emoteMale: "🦦"
		},
		56: {
			emoteFemale: "🐅",
			emoteMale: "🐅"
		},
		57: {
			emoteFemale: "🦁",
			emoteMale: "🦁"
		},
		58: {
			emoteFemale: "🦅",
			emoteMale: "🦅"
		},
		59: {
			emoteFemale: "🦤",
			emoteMale: "🦤"
		},
		6: {
			emoteFemale: "🐹",
			emoteMale: "🐹"
		},
		60: {
			emoteFemale: "🐆",
			emoteMale: "🐆"
		},
		61: {
			emoteFemale: "🦣",
			emoteMale: "🦣"
		},
		62: {
			emoteFemale: "🕊️",
			emoteMale: "🕊️"
		},
		63: {
			emoteFemale: "🦄️",
			emoteMale: "🦄️"
		},
		64: {
			emoteFemale: "🐉️",
			emoteMale: "🐉️"
		},
		65: {
			emoteFemale: "🦖️",
			emoteMale: "🦖️"
		},
		66: {
			emoteFemale: "🟣",
			emoteMale: "🔵"
		},
		67: {
			emoteFemale: "⛄",
			emoteMale: "⛄"
		},
		68: {
			emoteFemale: "🦆",
			emoteMale: "🦆"
		},
		69: {
			emoteFemale: "☃️",
			emoteMale: "☃️"
		},
		7: {
			emoteFemale: "🐇",
			emoteMale: "🐇"
		},
		70: {
			emoteFemale: "👽",
			emoteMale: "👽"
		},
		71: {
			emoteFemale: "🐙",
			emoteMale: "🐙"
		},
		72: {
			emoteFemale: "🐧",
			emoteMale: "🐧"
		},
		73: {
			emoteFemale: "🐟",
			emoteMale: "🐟"
		},
		74: {
			emoteFemale: "🐠",
			emoteMale: "🐠"
		},
		75: {
			emoteFemale: "🐡",
			emoteMale: "🐡"
		},
		76: {
			emoteFemale: "🪼",
			emoteMale: "🪼"
		},
		77: {
			emoteFemale: "🦈",
			emoteMale: "🦈"
		},
		78: {
			emoteFemale: "🐋",
			emoteMale: "🐋"
		},
		79: {
			emoteFemale: "🐳",
			emoteMale: "🐳"
		},
		8: {
			emoteFemale: "🐄",
			emoteMale: "🐂"
		},
		80: {
			emoteFemale: "🦐",
			emoteMale: "🦐"
		},
		81: {
			emoteFemale: "🦞",
			emoteMale: "🦞"
		},
		82: {
			emoteFemale: "🐬",
			emoteMale: "🐬"
		},
		83: {
			emoteFemale: "🐦‍🔥",
			emoteMale: "🐦‍🔥"
		},
		84: {
			emoteFemale: "🦕",
			emoteMale: "🦕"
		},
		85: {
			emoteFemale: "🐌",
			emoteMale: "🐌"
		},
		86: {
			emoteFemale: "🦀",
			emoteMale: "🦀"
		},
		87: {
			emoteFemale: "🦌",
			emoteMale: "🦌"
		},
		88: {
			emoteFemale: "🐃",
			emoteMale: "🐃"
		},
		89: {
			emoteFemale: "🦬",
			emoteMale: "🦬"
		},
		9: {
			emoteFemale: "🐖",
			emoteMale: "🐖"
		},
		90: {
			emoteFemale: "🦧",
			emoteMale: "🦧"
		},
		91: {
			emoteFemale: "🦍",
			emoteMale: "🦍"
		},
		92: {
			emoteFemale: "🐥",
			emoteMale: "🐥"
		},
		93: {
			emoteFemale: "🐀",
			emoteMale: "🐀"
		},
		94: {
			emoteFemale: "🐦‍⬛",
			emoteMale: "🐦‍⬛"
		},
		95: {
			emoteFemale: "🐦‍⬛",
			emoteMale: "🐦‍⬛"
		},
		96: {
			emoteFemale: "🫏",
			emoteMale: "🫏"
		},
		97: {
			emoteFemale: "🪿",
			emoteMale: "🪿"
		},
		98: {
			emoteFemale: "🦌",
			emoteMale: "🦌"
		}
	},
	monsters: {
		spider: "🕷️",
		slimyMutant: "🦠",
		skeleton: "💀",
		rockGolem: "🗿",
		magmaTitan: "🌋",
		forestTroll: "🧌",
		whiteWolf: "🐺",
		shinyElementary: "✨",
		crocodile: "🐊",
		yukiOnna: "❄️",
		celestialGuardian: "🌌",
		maleIceDragon: "🐲",
		femaleIceDragon: "🐉"
	},
	armors: {
		0: "⬛",
		1: "👁️",
		10: "🛡️",
		100: "🎭",
		101: "♨️",
		102: "💠",
		103: "🛡️",
		104: "🛡️",
		105: "🛡️",
		106: "🧰",
		107: "🛰️",
		108: "👻️",
		109: "🫐",
		11: "🛡️",
		110: "🌿",
		12: "🛡️",
		13: "🛡️",
		14: "🛡️",
		15: "🛡️",
		16: "🛡️",
		17: "🔆",
		18: "🥋",
		19: "🦺",
		2: "⛑️",
		20: "👨‍👩‍👧‍👦",
		21: "🦾",
		22: "🤖",
		23: "🌂",
		24: "🛡️",
		25: "🛡️",
		26: "🏉",
		27: "✨",
		28: "🛡️",
		29: "🛡️",
		3: "🛡️",
		30: "🛡️",
		31: "🛡️",
		32: "🛡️",
		33: "🛡️",
		34: "🛡️",
		35: "🛡️",
		36: "🛡️",
		37: "🛡️",
		38: "🛡️",
		39: "🪖",
		4: "🛡️",
		40: "🐢",
		41: "🪙",
		42: "🪖",
		43: "🪣",
		44: "🧱",
		45: "♟️",
		46: "🪟",
		47: "🏯",
		48: "🧥",
		49: "🧥",
		5: "🛡️",
		50: "🥼",
		51: "⛺",
		52: "🛡️",
		53: "🛡️",
		54: "🗿",
		55: "🤡",
		56: "🥱",
		57: "🪶",
		58: "🧞",
		59: "🧙",
		6: "🤺",
		60: "🧔🏻",
		61: "✨",
		62: "🛡️",
		63: "🍃",
		64: "🛡️",
		65: "🍌",
		66: "🛡️",
		67: "🦷",
		68: "✨",
		69: "🦏",
		7: "👘",
		70: "♨️",
		71: "🎩",
		72: "😷",
		73: "🏰",
		74: "🏰",
		75: "💉",
		76: "💀",
		77: "🌵",
		78: "🧢",
		79: "🦅",
		8: "🛡️",
		80: "🔮",
		81: "🤖",
		82: "⚪",
		83: "🏛️",
		84: "🛡️",
		85: "🛡️",
		86: "🛡️",
		87: "🛡️",
		88: "🦓",
		89: "🛡️",
		9: "🛡️",
		90: "🛡️",
		91: "🛡️",
		92: "🏯",
		93: "🚐",
		94: "⚡",
		95: "🤖",
		96: "🧙",
		97: "💎",
		98: "🔩",
		99: "🔩"
	},
	objects: {
		0: "⬛",
		1: "🏳️",
		10: "👞",
		11: "👼🏽",
		12: "🌑",
		13: "🍂",
		14: "🍎",
		15: "🍏",
		16: "💗",
		17: "📕",
		18: "📘",
		19: "📙",
		2: "🎲",
		20: "📗",
		21: "📿",
		22: "🏴",
		23: "⚜️",
		24: "🛢️",
		25: "🕯️",
		26: "🏺",
		27: "🎷",
		28: "🎸",
		29: "💳",
		3: "💎",
		30: "🦿",
		31: "😹",
		32: "🥄",
		33: "🎃",
		34: "🧸",
		35: "🧲",
		36: "🩹",
		37: "⛷️",
		38: "🌀",
		39: "💠",
		4: "🏵️",
		40: "👼",
		41: "🏺",
		42: "🕝",
		43: "🍌",
		44: "🍎",
		45: "🟧",
		46: "🌟",
		47: "📖",
		48: "🎥",
		49: "🧴",
		5: "🌝",
		50: "🥾",
		51: "🧹",
		52: "🧼",
		53: "🎖️",
		54: "📯",
		55: "💰",
		56: "🎰",
		57: "👠",
		58: "🪐",
		59: "🍫",
		6: "🔮",
		60: "🏢",
		61: "🕵️",
		62: "👁️",
		63: "⛏️",
		64: "🧱",
		65: "🎶",
		66: "🌐",
		67: "🚗",
		68: "🟦",
		69: "🎧",
		7: "⛓️",
		70: "🛏️",
		71: "🤖",
		72: "☀️",
		73: "🎢",
		74: "🌶️",
		75: "🔌",
		76: "🍖",
		77: "🧑‍⚕️",
		78: "❤️‍🩹",
		79: "🧬",
		8: "🍀",
		80: "🔋",
		81: "🔋",
		82: "🪳",
		83: "🚀",
		84: "🍀",
		85: "🧻",
		86: "🌟",
		87: "🎸",
		88: "💾",
		89: "🐟",
		9: "🗝️",
		90: "🐸",
		91: "🛰️",
		92: "🪈",
		93: "🥝"
	},
	potions: {
		0: "⬛",
		1: "🍷",
		10: "🍇",
		11: "🍇",
		12: "⚗️",
		13: "⚗️",
		14: "⚗️",
		15: "⚗️",
		16: "🧃",
		17: "🧃",
		18: "🍸",
		19: "🍸",
		2: "🍷",
		20: "🍸",
		21: "🍸",
		22: "❤️",
		23: "❤️",
		24: "❤️",
		25: "🍹",
		26: "🥛",
		27: "🍼",
		28: "🍵",
		29: "☕",
		3: "🍷",
		30: "🥃",
		31: "🥘",
		32: "💧",
		33: "🍷",
		34: "🐣",
		35: "⛽",
		36: "🍵",
		37: "🥤",
		38: "🍶",
		39: "🧉",
		4: "🍷",
		40: "🍾",
		41: "🧪",
		42: "❤️",
		43: "🥤",
		44: "🐺",
		45: "🌱",
		46: "🌶",
		47: "☠",
		48: "🔋",
		49: "🥜",
		5: "🍷",
		50: "🍺",
		51: "🥫",
		52: "🥫",
		53: "🥫",
		54: "🪅",
		55: "🫕",
		56: "💩",
		57: "🩸",
		58: "🧱",
		59: "🫧",
		6: "🧪",
		60: "💦",
		61: "🚱",
		62: "🌊",
		63: "🫙",
		64: "♻",
		65: "🫗",
		66: "🧋",
		67: "🧃",
		68: "🧃",
		69: "🍯",
		7: "🧪",
		70: "🧅",
		71: "🗻",
		72: "⛈",
		73: "☕",
		74: "🫗",
		75: "🌵",
		76: "🚿",
		77: "🛵",
		78: "🧼",
		79: "🪷",
		8: "🧪",
		80: "🥶",
		81: "✒",
		82: "🛏",
		83: "🌂",
		84: "🪶",
		85: "💉",
		86: "🍸",
		87: "🏴‍☠️",
		88: "🐌",
		89: "♨",
		9: "🧪",
		90: "🥔",
		91: "🌊",
		92: "🧌",
		93: "🌋",
		94: "🍫"
	},
	weapons: {
		0: "👊",
		1: "⚡",
		10: "⚔️",
		11: "🔫",
		12: "💉",
		13: "💣",
		14: "🎸",
		15: "⚔️",
		16: "⛏️",
		17: "🔧",
		18: "🪵",
		19: "🔪",
		2: "🛠️",
		20: "🌿",
		21: "⛏️",
		22: "🏹",
		23: "🍳",
		24: "✂️",
		25: "🗡️",
		26: "🏑",
		27: "🗡️",
		28: "🔨",
		29: "🔪",
		3: "🏏",
		30: "🥊",
		31: "🤜",
		32: "🎣",
		33: "🔪",
		34: "🎣",
		35: "🎣",
		36: "⚔️",
		37: "⚔️",
		38: "⚔️",
		39: "⚔️",
		4: "🏹",
		40: "⚔️",
		41: "⚔️",
		42: "🔫",
		43: "🥒",
		44: "💐",
		45: "🍌",
		46: "🔖",
		47: "❄️",
		48: "🏹",
		49: "🏹",
		5: "🔨",
		50: "🏹",
		51: "🏹",
		52: "🪒",
		53: "🪑",
		54: "🧱",
		55: "🍴",
		56: "🗡️",
		57: "🧯",
		58: "🔖",
		59: "💉",
		6: "🔪",
		60: "💉",
		61: "💉",
		62: "🦠",
		63: "💣",
		64: "🕯️",
		65: "🥢",
		66: "⚔️",
		67: "⚔️",
		68: "🤛",
		69: "⚔️",
		7: "🗡️",
		70: "🔫",
		71: "⚔️",
		72: "⚽",
		73: "🪓",
		74: "☄️",
		75: "🪃",
		76: "⚡",
		77: "🤿",
		78: "🫂",
		79: "🌂",
		8: "📌",
		80: "🎆",
		81: "🗡️",
		82: "🦶",
		83: "🤬",
		84: "🪛",
		85: "❤️",
		86: "🎭",
		87: "⚠️",
		88: "🪶",
		89: "🐉",
		9: "🔧",
		90: "🦄",
		91: "🍭",
		92: "🎮",
		93: "🍴",
		94: "💀",
		95: "🗯️",
		96: "⚛️",
		97: "🐦‍🔥",
		98: "❄️",
		99: "🦅"
	},
	classes: {
		0: "🌿",
		1: "🪓",
		10: "🏹",
		11: "🔫",
		12: "🧹",
		13: "🏇",
		14: "🦯",
		15: "🤺",
		16: "⚜️",
		17: "🔱",
		18: "⚔️",
		19: "🛡️",
		2: "🗡️",
		20: "🔫",
		21: "🤺",
		22: "⚜️",
		23: "🔱",
		24: "🧙",
		3: "⚔️",
		4: "🥊",
		5: "🪖",
		6: "⛓️",
		7: "🛡️",
		8: "🪨",
		9: "🦾"
	},
	witchSmallEvent: {
		bat: "🦇",
		beer: "🍺",
		bigWait: "🕙",
		bigWarm: "🔥",
		blood: "🩸",
		bone: "🦴",
		book: "📖",
		cobweb: "🕸️",
		chicken: "🐔",
		cool: "❄️",
		crystalBall: "🔮",
		distiller: "⚗️",
		eye: "👁️",
		frog: "🐸",
		greenApple: "🍏",
		heart: "🫀",
		mushroom: "🍄",
		nothing: "🤷",
		package: "📦",
		rat: "🐀",
		redApple: "🍎",
		rose: "🌹",
		scorpion: "🦂",
		smallWait: "⏳",
		smallWarm: "🌡️",
		snake: "🐍",
		spider: "🕷️",
		stir: "🥄",
		teeth: "🦷",
		testTube: "🧪",
		turtle: "🐢",
		wand: "🪄",
		wiltedRose: "🥀",
		worm: "🪱"
	},
	cartSmallEvent: {
		accept: "🚗",
		refuse: "🚶"
	},
	infoFightSmallEvent: {
		showHandednessInfo: "✋"
	},
	fightCommand: {
		accept: "🔍",
		aiThinking: "🧠",
		clipboard: "📋",
		crossedSwords: "⚔️",
		shield: "🛡️",
		fighterStats: "👤",
		gameStats: "📊",
		gloryChange: "📯",
		handshake: "🤝",
		refuse: "❌"
	},
	clocks: {
		1: "🕐",
		10: "🕙"
	},
	pveFights: {
		waitABit: "⏳",
		startFight: "⚔️"
	},
	foods: {
		herbivorousFood: "🥬",
		commonFood: "🍬",
		carnivorousFood: "🍖",
		ultimateFood: "🍲"
	},
	collectors: {
		accept: "✅",
		refuse: "❌",
		lottery: {
			easy: "🪙",
			medium: "💵",
			hard: "💰"
		},
		interactPoorCoin: "🪙",
		warning: "⚠️",
		question: "❓",
		back: "↩️",
		switch: "🔄",
		previousPage: "⬅️",
		nextPage: "➡️"
	},
	fightActions: {
		aerialDiveAttack: "🦅",
		alliesArePresent: "💀",
		ambush: "😶‍🌫️",
		benediction: "👼",
		bleeding: "🩸",
		blind: "🫣",
		blizzardRageAttack: "🌨️",
		boomerangAttack: "🪃",
		boulderTossAttack: "🪨",
		breathTakingAttack: "💨",
		burned: "🥵",
		callPack: "🐺",
		canonAttack: "🔫",
		chargeChargeRadiantBlastAttack: "☀️",
		chargeChargingAttack: "🧲",
		chargeClubSmashAttack: "🏏",
		chargeRadiantBlastAttack: "☀️",
		chargeUltimateAttack: "☄️",
		chargingAttack: "🧲",
		clawAttack: "🐾",
		clubSmashAttack: "🏏",
		concentrated: "🎯",
		concentration: "🎯",
		confused: "🤯",
		counterAttack: "🥊",
		crystalShardAttack: "🔮",
		crystallineArmorAttack: "🧊",
		cursed: "👻",
		cursedAttack: "😈",
		darkAttack: "✴️",
		defenseBuff: "🧘",
		dirty: "🗑️",
		divineAttack: "🙏",
		energeticAttack: "⚡",
		eruptionAttack: "🌋",
		familyMealAttack: "🍽️",
		fireAttack: "🔥",
		frozen: "🥶",
		frozenKissAttack: "💋",
		full: "😴",
		getDirty: "💩",
		glacialBreathAttack: "🐉",
		glacialCaveCollapseAttack: "💥",
		grabAndThrowAttack: "🥋",
		guildAttack: "🏟️",
		hammerQuakeAttack: "🔨",
		hardBiteAttack: "🦷",
		heatDrainAttack: "🌡️",
		heatMudAttack: "🏺",
		heavyAttack: "🏋️",
		howlAttack: "🌕",
		icySeductionAttack: "❄️",
		intenseAttack: "😤",
		isStuckInPolarEmbrace: "🤍",
		lavaWaveAttack: "♨️",
		lightRayAttack: "🔆",
		magicMimicAttack: "🎭",
		magmaBathAttack: "🛀",
		mudShotAttack: "🧑‍🌾",
		none: "🚫",
		outOfBreath: "😮‍💨",
		outrage: "😡",
		outrageAttack: "💢",
		packAttack: "🐺",
		paralyzed: "🚷",
		petrificationAttack: "🪦",
		petrified: "🗿",
		piercingAttack: "🪡",
		poisoned: "🤢",
		poisonousAttack: "🧪",
		powerfulAttack: "🪓",
		protected: "💞",
		protection: "🙅",
		quickAttack: "🗡️",
		radiantBlastAttack: "☀️",
		rageExplosion: "🤬",
		ramAttack: "🐏",
		resting: "🛏️",
		roarAttack: "📢",
		rockShieldAttack: "⛰️",
		sabotageAttack: "🛠️",
		shieldAttack: "🛡️",
		simpleAttack: "⚔️",
		slamAttack: "🦶",
		slowed: "🦥",
		spectralRevengeAttack: "👻",
		startPolarEmbraceAttack: "🤍",
		stealth: "😶‍🌫️",
		stoneSkinAttack: "🧱",
		stunned: "😖",
		summonAttack: "🧑‍🤝‍🧑",
		swallowed: "👄",
		tailWhipAttack: "🐊",
		targeted: "↩️",
		ultimateAttack: "☄️",
		weak: "🤧",
		webShotAttack: "🕸️"

	},
	classKinds: {
		basic: "⚖️",
		attack: "🗡️",
		defense: "🛡️",
		other: "⚗️"
	},
	announcements: {
		trophy: "🏆"
	},
	commands: {
		respawn: "👼",
		classes: "📑",
		classesInfo: "🔖",
		classesDescription: "📜",
		shop: "🛒",
		language: "🌍",
		report: "📰",
		rarity: "🎰",
		vote: "🗳️",
		badges: "🎖️",
		inventory: "💼",
		ping: "🏓"
	},
	unitValues: {
		score: "🏅",
		money: "💰",
		lostMoney: "💸",
		xp: "⭐",
		gem: "💎",
		guildPoint: "🪩",
		health: "❤️",
		lostHealth: "💔",
		energy: "⚡",
		rage: "💢",
		time: "🕜",
		attack: "🗡️",
		defense: "🛡️",
		speed: "🚀",
		breath: "🌬️",
		breathRegen: "🫁",
		petRarity: "⭐",
		glory: "✨",
		timeGain: "⌛"
	},
	shopItems: {
		randomItem: "❓",
		healAlteration: "🏥",
		healEnergy: "⚡",
		regen: "💓",
		moneyMouthBadge: "🤑",
		inventoryExtension: "📦",
		smallGuildXp: "⭐",
		bigGuildXp: "🌟",
		skipMission: "🧾",
		lovePointsValue: "🧑‍⚕️",
		treasure: "👑"
	},
	badges: {
		[Badge.BEST_V1_PLAYER]: "🏆",
		[Badge.TOP_10_V1]: "🏅",
		[Badge.BOT_OWNER]: "👑",
		[Badge.TECHNICAL_TEAM]: "⚙️",
		[Badge.TOP_GLORY]: "✨",
		[Badge.SUPPORT]: "❤️",
		[Badge.CONTEST]: "🍀",
		[Badge.DONOR]: "💸",
		[Badge.MAJOR_BUG_REPORTER]: "🐞",
		[Badge.RANDOM]: "🎰",
		[Badge.FIRST_20_MEMBERS]: "⛑️",
		[Badge.TOP_1_BEFORE_RESET]: "🥇",
		[Badge.RICH]: "🤑",
		[Badge.ADVERTISER]: "🌟",
		[Badge.REDACTOR]: "🖋️",
		[Badge.TRANSLATOR]: "🌍",
		[Badge.TOP_WEEK]: "🎗️",
		[Badge.CHRISTMAS]: "🎄",
		[Badge.FUNNY]: "😂",
		[Badge.POWERFUL_GUILD]: "💎",
		[Badge.VERY_POWERFUL_GUILD]: "🪩",
		[Badge.TOURNAMENT_WINNER]: "⚔️",
		[Badge.EARLY_CLASS_ADOPTER]: "🔖",
		[Badge.LEGENDARY_PET]: "💞",
		[Badge.MISSION_COMPLETER]: "💍",
		[Badge.GOOD_BUG_REPORTER]: "🕊️",
		[Badge.VOTER]: "🗳️",
		[Badge.ANIMAL_LOVER]: "🐾"
	},
	itemKinds: [
		"⚔️",
		"🛡️",
		"⚗️",
		"🧸"
	],
	notifications: {
		bell: "🔔",
		sendLocation: "📩",
		back: "↩️",
		types: {
			report: "📰",
			guildDaily: "🏟️",
			guildKick: "🚪",
			playerFreedFromJail: "🔓",
			fightChallenge: "⚔️",
			guildStatusChange: "📜"
		}
	},
	missions: {
		expired: "📤",
		daily: "📅",
		campaign: "📖",
		sideMission: "📜",
		total: "🧾",
		book: "📖"
	},
	messages: {
		validate: "✅",
		refuse: "❌",
		notReplied: "🔚",
		dm: "💌",
		description: "📜",
		item: "▶️",
		info: "ℹ️"
	},
	fightPetActions: {
		fistHit: "👊",
		runAway: "🏃",
		focusEnergy: "⚡",
		intimidate: "💪",
		baitWithMeat: "🍖",
		provoke: "😤",
		baitWithVegetables: "🥕",
		doNothing: "🤷",
		lastEffort: "🔥",
		protect: "🛡️",
		usePlayerPet: "🐾",
		playDead: "💀",
		scream: "😱",
		prayGod: "🙏",
		attackLeft: "🤛",
		attackRight: "🤜",
		helpFromMates: "🏟️"
	},
	rewards: {
		item: "🎁",
		partialHeal: "💟"
	},
	goblets: {
		metal: "🐲",
		biggest: "🪣",
		sparkling: "✨"
	},
	sex: {
		male: "♂️",
		female: "♀️"
	},
	diet: {
		omnivorous: "🥪",
		herbivorous: "🥬",
		carnivorous: "🥩"
	},
	petInformation: {
		loveScore: "💖",
		diet: "🍽️",
		nextFeed: "🕙",
		fightEffect: "⚔️",
		age: "👶"
	},
	petCommand: {
		petButton: "🖐️",
		pet: "😻"
	},
	leagues: {
		0: "🌲",
		1: "🗿",
		2: "⚔️",
		3: "🥉",
		4: "🥈",
		5: "🥇",
		6: "💎",
		7: "💯",
		8: "🌀",
		9: "🏆"
	},
	top: {
		badges: {
			first: "🥇",
			second: "🥈",
			third: "🥉",
			fourth: "🏅",
			fifth: "🏅",
			self: "🔵",
			sameContext: "⚪",
			default: "⚫"
		},
		afk: "👻",
		allTime: "🗓️️",
		weekly: "🕤",
		congrats: "🏆",
		error: "❌",
		guild: "🏟️"
	},
	petTransfer: {
		deposit: "📥",
		switch: "🔄",
		withdraw: "📤"
	},
	other: {
		trash: "🗑️",
		tada: "🎉",
		guild: "🏟️",
		island: "🏝️",
		increase: "🔼",
		advice: "💡",
		why: "🤔",
		crown: "👑",
		incoming: "📥",
		outgoing: "📤",
		right: "➡️",
		look: "👀",
		paperclip: "📎",
		folder: "📁",
		cantSpeak: "🤐",
		expressionless: "😑",
		wink: "😉",
		gear: "⚙️",
		singing: "🎵",
		telescope: "🔭",
		car: "🚗",
		walking: "🚶",
		leagueUp: "↗️️",
		leagueDown: "↘️"
	},
	guild: {
		icon: "🏟️",
		chief: "👑",
		elder: "🎖️",
		member: "⚫",
		isOnPveIsland: "🏝️",
		isOnBoat: "⛴️",
		countAsAnAlly: "🤝",
		cannotBeJoinedOnBoat: "👻",
		membersCount: "🙎"
	},
	networks: {
		website: "🌐",
		discord: "🗣️"
	},
	languages: {
		de: "🇩🇪",
		en: "🇬🇧",
		es: "🇪🇸",
		fr: "🇫🇷",
		it: "🇮🇹",
		pt: "🇵🇹"
	},
	languageFlavors: {
		de: "🍺",
		en: "🍵",
		es: "🐂",
		fr: "🥖",
		it: "🍕",
		pt: "🐓"
	},
	rarity: [
		"🔸",
		"🔶",
		"🔥",
		"🔱",
		"☄️",
		"💫",
		"⭐",
		"🌟",
		"💎"
	],
	loveLevels: [
		"NOT_A_LEVEL",
		"😼",
		"😾",
		"🙀",
		"😺",
		"😻"
	],
	userKind: {
		human: "👤",
		robot: "🤖",
		pet: "🐶"
	},
	inventory: {
		empty: "⬛",
		stock: "📦"
	},
	itemNatures: [
		"❌",
		"❤️",
		"🚀",
		"⚔️",
		"🛡️",
		"🕥",
		"💰",
		"⚡"
	],
	itemCategories: [
		"⚔️",
		"🛡️",
		"⚗️",
		"🧸"
	],
	profile: {
		displayAllBadgeEmote: "🎖️"
	},
	fightHistory: {
		won: "🟢",
		lost: "🔴",
		draw: "🟡"
	}
};
