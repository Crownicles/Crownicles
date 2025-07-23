export interface FromServerPacket {}
import * as $protobuf from "protobufjs";
import Long = require("long");
/** Properties of a PingRes. */
export interface IPingRes extends FromServerPacket {

    /** PingRes time */
    time: number;
}

/** Represents a PingRes. */
export class PingRes implements IPingRes {

    /**
     * Constructs a new PingRes.
     * @param [properties] Properties to set
     */
    constructor(properties?: IPingRes);

    /** PingRes time. */
    public time: number;

    /**
     * Creates a new PingRes instance using the specified properties.
     * @param [properties] Properties to set
     * @returns PingRes instance
     */
    public static create(properties?: IPingRes): PingRes;

    /**
     * Encodes the specified PingRes message. Does not implicitly {@link PingRes.verify|verify} messages.
     * @param message PingRes message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IPingRes, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified PingRes message, length delimited. Does not implicitly {@link PingRes.verify|verify} messages.
     * @param message PingRes message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IPingRes, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a PingRes message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns PingRes
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): PingRes;

    /**
     * Decodes a PingRes message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns PingRes
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): PingRes;

    /**
     * Verifies a PingRes message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a PingRes message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns PingRes
     */
    public static fromObject(object: { [k: string]: any }): PingRes;

    /**
     * Creates a plain object from a PingRes message. Also converts values to other types if specified.
     * @param message PingRes
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: PingRes, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this PingRes to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for PingRes
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a ProfileNotFound. */
export interface IProfileNotFound extends FromServerPacket {
}

/** Represents a ProfileNotFound. */
export class ProfileNotFound implements IProfileNotFound {

    /**
     * Constructs a new ProfileNotFound.
     * @param [properties] Properties to set
     */
    constructor(properties?: IProfileNotFound);

    /**
     * Creates a new ProfileNotFound instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ProfileNotFound instance
     */
    public static create(properties?: IProfileNotFound): ProfileNotFound;

    /**
     * Encodes the specified ProfileNotFound message. Does not implicitly {@link ProfileNotFound.verify|verify} messages.
     * @param message ProfileNotFound message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IProfileNotFound, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified ProfileNotFound message, length delimited. Does not implicitly {@link ProfileNotFound.verify|verify} messages.
     * @param message ProfileNotFound message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IProfileNotFound, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a ProfileNotFound message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ProfileNotFound
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): ProfileNotFound;

    /**
     * Decodes a ProfileNotFound message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ProfileNotFound
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): ProfileNotFound;

    /**
     * Verifies a ProfileNotFound message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a ProfileNotFound message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ProfileNotFound
     */
    public static fromObject(object: { [k: string]: any }): ProfileNotFound;

    /**
     * Creates a plain object from a ProfileNotFound message. Also converts values to other types if specified.
     * @param message ProfileNotFound
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: ProfileNotFound, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this ProfileNotFound to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for ProfileNotFound
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a ProfileRes. */
export interface IProfileRes extends FromServerPacket {

    /** ProfileRes badges */
    badges?: (string[]|null);

    /** ProfileRes stats */
    stats?: (ProfileRes.IStats|null);

    /** ProfileRes missions */
    missions: ProfileRes.IMissions;

    /** ProfileRes rank */
    rank: ProfileRes.IRank;

    /** ProfileRes effect */
    effect: ProfileRes.IEffect;

    /** ProfileRes classId */
    classId?: (number|null);

    /** ProfileRes fightRanking */
    fightRanking?: (ProfileRes.IFightRanking|null);

    /** ProfileRes guild */
    guild?: (string|null);

    /** ProfileRes destinationId */
    destinationId?: (number|null);

    /** ProfileRes mapTypeId */
    mapTypeId?: (string|null);

    /** ProfileRes pet */
    pet?: (ProfileRes.IPet|null);

    /** ProfileRes color */
    color: string;

    /** ProfileRes level */
    level: number;

    /** ProfileRes health */
    health: ProfileRes.IHealth;

    /** ProfileRes experience */
    experience: ProfileRes.IExperience;

    /** ProfileRes money */
    money: number;

    /** ProfileRes pseudo */
    pseudo: string;
}

/** Represents a ProfileRes. */
export class ProfileRes implements IProfileRes {

    /**
     * Constructs a new ProfileRes.
     * @param [properties] Properties to set
     */
    constructor(properties?: IProfileRes);

    /** ProfileRes badges. */
    public badges: string[];

    /** ProfileRes stats. */
    public stats?: (ProfileRes.IStats|null);

    /** ProfileRes missions. */
    public missions: ProfileRes.IMissions;

    /** ProfileRes rank. */
    public rank: ProfileRes.IRank;

    /** ProfileRes effect. */
    public effect: ProfileRes.IEffect;

    /** ProfileRes classId. */
    public classId: number;

    /** ProfileRes fightRanking. */
    public fightRanking?: (ProfileRes.IFightRanking|null);

    /** ProfileRes guild. */
    public guild: string;

    /** ProfileRes destinationId. */
    public destinationId: number;

    /** ProfileRes mapTypeId. */
    public mapTypeId: string;

    /** ProfileRes pet. */
    public pet?: (ProfileRes.IPet|null);

    /** ProfileRes color. */
    public color: string;

    /** ProfileRes level. */
    public level: number;

    /** ProfileRes health. */
    public health: ProfileRes.IHealth;

    /** ProfileRes experience. */
    public experience: ProfileRes.IExperience;

    /** ProfileRes money. */
    public money: number;

    /** ProfileRes pseudo. */
    public pseudo: string;

    /**
     * Creates a new ProfileRes instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ProfileRes instance
     */
    public static create(properties?: IProfileRes): ProfileRes;

    /**
     * Encodes the specified ProfileRes message. Does not implicitly {@link ProfileRes.verify|verify} messages.
     * @param message ProfileRes message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IProfileRes, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified ProfileRes message, length delimited. Does not implicitly {@link ProfileRes.verify|verify} messages.
     * @param message ProfileRes message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IProfileRes, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a ProfileRes message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ProfileRes
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): ProfileRes;

    /**
     * Decodes a ProfileRes message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ProfileRes
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): ProfileRes;

    /**
     * Verifies a ProfileRes message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a ProfileRes message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ProfileRes
     */
    public static fromObject(object: { [k: string]: any }): ProfileRes;

    /**
     * Creates a plain object from a ProfileRes message. Also converts values to other types if specified.
     * @param message ProfileRes
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: ProfileRes, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this ProfileRes to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for ProfileRes
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

export namespace ProfileRes {

    /** Properties of a Stats. */
    interface IStats {

        /** Stats energy */
        energy: ProfileRes.Stats.IEnergy;

        /** Stats attack */
        attack: number;

        /** Stats defense */
        defense: number;

        /** Stats speed */
        speed: number;

        /** Stats breath */
        breath: ProfileRes.Stats.IBreath;
    }

    /** Represents a Stats. */
    class Stats implements IStats {

        /**
         * Constructs a new Stats.
         * @param [properties] Properties to set
         */
        constructor(properties?: ProfileRes.IStats);

        /** Stats energy. */
        public energy: ProfileRes.Stats.IEnergy;

        /** Stats attack. */
        public attack: number;

        /** Stats defense. */
        public defense: number;

        /** Stats speed. */
        public speed: number;

        /** Stats breath. */
        public breath: ProfileRes.Stats.IBreath;

        /**
         * Creates a new Stats instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Stats instance
         */
        public static create(properties?: ProfileRes.IStats): ProfileRes.Stats;

        /**
         * Encodes the specified Stats message. Does not implicitly {@link ProfileRes.Stats.verify|verify} messages.
         * @param message Stats message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: ProfileRes.IStats, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified Stats message, length delimited. Does not implicitly {@link ProfileRes.Stats.verify|verify} messages.
         * @param message Stats message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: ProfileRes.IStats, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a Stats message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Stats
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): ProfileRes.Stats;

        /**
         * Decodes a Stats message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Stats
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): ProfileRes.Stats;

        /**
         * Verifies a Stats message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a Stats message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Stats
         */
        public static fromObject(object: { [k: string]: any }): ProfileRes.Stats;

        /**
         * Creates a plain object from a Stats message. Also converts values to other types if specified.
         * @param message Stats
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: ProfileRes.Stats, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Stats to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Stats
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    namespace Stats {

        /** Properties of an Energy. */
        interface IEnergy {

            /** Energy value */
            value: number;

            /** Energy max */
            max: number;
        }

        /** Represents an Energy. */
        class Energy implements IEnergy {

            /**
             * Constructs a new Energy.
             * @param [properties] Properties to set
             */
            constructor(properties?: ProfileRes.Stats.IEnergy);

            /** Energy value. */
            public value: number;

            /** Energy max. */
            public max: number;

            /**
             * Creates a new Energy instance using the specified properties.
             * @param [properties] Properties to set
             * @returns Energy instance
             */
            public static create(properties?: ProfileRes.Stats.IEnergy): ProfileRes.Stats.Energy;

            /**
             * Encodes the specified Energy message. Does not implicitly {@link ProfileRes.Stats.Energy.verify|verify} messages.
             * @param message Energy message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: ProfileRes.Stats.IEnergy, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified Energy message, length delimited. Does not implicitly {@link ProfileRes.Stats.Energy.verify|verify} messages.
             * @param message Energy message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: ProfileRes.Stats.IEnergy, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes an Energy message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns Energy
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): ProfileRes.Stats.Energy;

            /**
             * Decodes an Energy message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns Energy
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): ProfileRes.Stats.Energy;

            /**
             * Verifies an Energy message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates an Energy message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns Energy
             */
            public static fromObject(object: { [k: string]: any }): ProfileRes.Stats.Energy;

            /**
             * Creates a plain object from an Energy message. Also converts values to other types if specified.
             * @param message Energy
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: ProfileRes.Stats.Energy, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this Energy to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for Energy
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a Breath. */
        interface IBreath {

            /** Breath base */
            base: number;

            /** Breath max */
            max: number;

            /** Breath regen */
            regen: number;
        }

        /** Represents a Breath. */
        class Breath implements IBreath {

            /**
             * Constructs a new Breath.
             * @param [properties] Properties to set
             */
            constructor(properties?: ProfileRes.Stats.IBreath);

            /** Breath base. */
            public base: number;

            /** Breath max. */
            public max: number;

            /** Breath regen. */
            public regen: number;

            /**
             * Creates a new Breath instance using the specified properties.
             * @param [properties] Properties to set
             * @returns Breath instance
             */
            public static create(properties?: ProfileRes.Stats.IBreath): ProfileRes.Stats.Breath;

            /**
             * Encodes the specified Breath message. Does not implicitly {@link ProfileRes.Stats.Breath.verify|verify} messages.
             * @param message Breath message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: ProfileRes.Stats.IBreath, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified Breath message, length delimited. Does not implicitly {@link ProfileRes.Stats.Breath.verify|verify} messages.
             * @param message Breath message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: ProfileRes.Stats.IBreath, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a Breath message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns Breath
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): ProfileRes.Stats.Breath;

            /**
             * Decodes a Breath message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns Breath
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): ProfileRes.Stats.Breath;

            /**
             * Verifies a Breath message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a Breath message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns Breath
             */
            public static fromObject(object: { [k: string]: any }): ProfileRes.Stats.Breath;

            /**
             * Creates a plain object from a Breath message. Also converts values to other types if specified.
             * @param message Breath
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: ProfileRes.Stats.Breath, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this Breath to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for Breath
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }
    }

    /** Properties of a Missions. */
    interface IMissions {

        /** Missions gems */
        gems: number;

        /** Missions campaignProgression */
        campaignProgression: number;
    }

    /** Represents a Missions. */
    class Missions implements IMissions {

        /**
         * Constructs a new Missions.
         * @param [properties] Properties to set
         */
        constructor(properties?: ProfileRes.IMissions);

        /** Missions gems. */
        public gems: number;

        /** Missions campaignProgression. */
        public campaignProgression: number;

        /**
         * Creates a new Missions instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Missions instance
         */
        public static create(properties?: ProfileRes.IMissions): ProfileRes.Missions;

        /**
         * Encodes the specified Missions message. Does not implicitly {@link ProfileRes.Missions.verify|verify} messages.
         * @param message Missions message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: ProfileRes.IMissions, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified Missions message, length delimited. Does not implicitly {@link ProfileRes.Missions.verify|verify} messages.
         * @param message Missions message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: ProfileRes.IMissions, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a Missions message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Missions
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): ProfileRes.Missions;

        /**
         * Decodes a Missions message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Missions
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): ProfileRes.Missions;

        /**
         * Verifies a Missions message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a Missions message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Missions
         */
        public static fromObject(object: { [k: string]: any }): ProfileRes.Missions;

        /**
         * Creates a plain object from a Missions message. Also converts values to other types if specified.
         * @param message Missions
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: ProfileRes.Missions, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Missions to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Missions
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Rank. */
    interface IRank {

        /** Rank unranked */
        unranked: boolean;

        /** Rank rank */
        rank: number;

        /** Rank numberOfPlayers */
        numberOfPlayers: number;

        /** Rank score */
        score: number;
    }

    /** Represents a Rank. */
    class Rank implements IRank {

        /**
         * Constructs a new Rank.
         * @param [properties] Properties to set
         */
        constructor(properties?: ProfileRes.IRank);

        /** Rank unranked. */
        public unranked: boolean;

        /** Rank rank. */
        public rank: number;

        /** Rank numberOfPlayers. */
        public numberOfPlayers: number;

        /** Rank score. */
        public score: number;

        /**
         * Creates a new Rank instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Rank instance
         */
        public static create(properties?: ProfileRes.IRank): ProfileRes.Rank;

        /**
         * Encodes the specified Rank message. Does not implicitly {@link ProfileRes.Rank.verify|verify} messages.
         * @param message Rank message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: ProfileRes.IRank, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified Rank message, length delimited. Does not implicitly {@link ProfileRes.Rank.verify|verify} messages.
         * @param message Rank message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: ProfileRes.IRank, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a Rank message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Rank
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): ProfileRes.Rank;

        /**
         * Decodes a Rank message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Rank
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): ProfileRes.Rank;

        /**
         * Verifies a Rank message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a Rank message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Rank
         */
        public static fromObject(object: { [k: string]: any }): ProfileRes.Rank;

        /**
         * Creates a plain object from a Rank message. Also converts values to other types if specified.
         * @param message Rank
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: ProfileRes.Rank, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Rank to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Rank
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of an Effect. */
    interface IEffect {

        /** Effect healed */
        healed: boolean;

        /** Effect timeLeft */
        timeLeft: number;

        /** Effect effect */
        effect: string;

        /** Effect hasTimeDisplay */
        hasTimeDisplay: boolean;
    }

    /** Represents an Effect. */
    class Effect implements IEffect {

        /**
         * Constructs a new Effect.
         * @param [properties] Properties to set
         */
        constructor(properties?: ProfileRes.IEffect);

        /** Effect healed. */
        public healed: boolean;

        /** Effect timeLeft. */
        public timeLeft: number;

        /** Effect effect. */
        public effect: string;

        /** Effect hasTimeDisplay. */
        public hasTimeDisplay: boolean;

        /**
         * Creates a new Effect instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Effect instance
         */
        public static create(properties?: ProfileRes.IEffect): ProfileRes.Effect;

        /**
         * Encodes the specified Effect message. Does not implicitly {@link ProfileRes.Effect.verify|verify} messages.
         * @param message Effect message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: ProfileRes.IEffect, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified Effect message, length delimited. Does not implicitly {@link ProfileRes.Effect.verify|verify} messages.
         * @param message Effect message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: ProfileRes.IEffect, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes an Effect message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Effect
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): ProfileRes.Effect;

        /**
         * Decodes an Effect message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Effect
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): ProfileRes.Effect;

        /**
         * Verifies an Effect message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates an Effect message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Effect
         */
        public static fromObject(object: { [k: string]: any }): ProfileRes.Effect;

        /**
         * Creates a plain object from an Effect message. Also converts values to other types if specified.
         * @param message Effect
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: ProfileRes.Effect, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Effect to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Effect
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Pet. */
    interface IPet {

        /** Pet typeId */
        typeId: number;

        /** Pet sex */
        sex: string;

        /** Pet rarity */
        rarity: number;

        /** Pet nickname */
        nickname: string;
    }

    /** Represents a Pet. */
    class Pet implements IPet {

        /**
         * Constructs a new Pet.
         * @param [properties] Properties to set
         */
        constructor(properties?: ProfileRes.IPet);

        /** Pet typeId. */
        public typeId: number;

        /** Pet sex. */
        public sex: string;

        /** Pet rarity. */
        public rarity: number;

        /** Pet nickname. */
        public nickname: string;

        /**
         * Creates a new Pet instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Pet instance
         */
        public static create(properties?: ProfileRes.IPet): ProfileRes.Pet;

        /**
         * Encodes the specified Pet message. Does not implicitly {@link ProfileRes.Pet.verify|verify} messages.
         * @param message Pet message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: ProfileRes.IPet, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified Pet message, length delimited. Does not implicitly {@link ProfileRes.Pet.verify|verify} messages.
         * @param message Pet message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: ProfileRes.IPet, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a Pet message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Pet
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): ProfileRes.Pet;

        /**
         * Decodes a Pet message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Pet
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): ProfileRes.Pet;

        /**
         * Verifies a Pet message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a Pet message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Pet
         */
        public static fromObject(object: { [k: string]: any }): ProfileRes.Pet;

        /**
         * Creates a plain object from a Pet message. Also converts values to other types if specified.
         * @param message Pet
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: ProfileRes.Pet, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Pet to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Pet
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a FightRanking. */
    interface IFightRanking {

        /** FightRanking glory */
        glory: number;

        /** FightRanking league */
        league: number;
    }

    /** Represents a FightRanking. */
    class FightRanking implements IFightRanking {

        /**
         * Constructs a new FightRanking.
         * @param [properties] Properties to set
         */
        constructor(properties?: ProfileRes.IFightRanking);

        /** FightRanking glory. */
        public glory: number;

        /** FightRanking league. */
        public league: number;

        /**
         * Creates a new FightRanking instance using the specified properties.
         * @param [properties] Properties to set
         * @returns FightRanking instance
         */
        public static create(properties?: ProfileRes.IFightRanking): ProfileRes.FightRanking;

        /**
         * Encodes the specified FightRanking message. Does not implicitly {@link ProfileRes.FightRanking.verify|verify} messages.
         * @param message FightRanking message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: ProfileRes.IFightRanking, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified FightRanking message, length delimited. Does not implicitly {@link ProfileRes.FightRanking.verify|verify} messages.
         * @param message FightRanking message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: ProfileRes.IFightRanking, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a FightRanking message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns FightRanking
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): ProfileRes.FightRanking;

        /**
         * Decodes a FightRanking message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns FightRanking
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): ProfileRes.FightRanking;

        /**
         * Verifies a FightRanking message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a FightRanking message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns FightRanking
         */
        public static fromObject(object: { [k: string]: any }): ProfileRes.FightRanking;

        /**
         * Creates a plain object from a FightRanking message. Also converts values to other types if specified.
         * @param message FightRanking
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: ProfileRes.FightRanking, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this FightRanking to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for FightRanking
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Health. */
    interface IHealth {

        /** Health value */
        value: number;

        /** Health max */
        max: number;
    }

    /** Represents a Health. */
    class Health implements IHealth {

        /**
         * Constructs a new Health.
         * @param [properties] Properties to set
         */
        constructor(properties?: ProfileRes.IHealth);

        /** Health value. */
        public value: number;

        /** Health max. */
        public max: number;

        /**
         * Creates a new Health instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Health instance
         */
        public static create(properties?: ProfileRes.IHealth): ProfileRes.Health;

        /**
         * Encodes the specified Health message. Does not implicitly {@link ProfileRes.Health.verify|verify} messages.
         * @param message Health message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: ProfileRes.IHealth, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified Health message, length delimited. Does not implicitly {@link ProfileRes.Health.verify|verify} messages.
         * @param message Health message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: ProfileRes.IHealth, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a Health message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Health
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): ProfileRes.Health;

        /**
         * Decodes a Health message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Health
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): ProfileRes.Health;

        /**
         * Verifies a Health message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a Health message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Health
         */
        public static fromObject(object: { [k: string]: any }): ProfileRes.Health;

        /**
         * Creates a plain object from a Health message. Also converts values to other types if specified.
         * @param message Health
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: ProfileRes.Health, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Health to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Health
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of an Experience. */
    interface IExperience {

        /** Experience value */
        value: number;

        /** Experience max */
        max: number;
    }

    /** Represents an Experience. */
    class Experience implements IExperience {

        /**
         * Constructs a new Experience.
         * @param [properties] Properties to set
         */
        constructor(properties?: ProfileRes.IExperience);

        /** Experience value. */
        public value: number;

        /** Experience max. */
        public max: number;

        /**
         * Creates a new Experience instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Experience instance
         */
        public static create(properties?: ProfileRes.IExperience): ProfileRes.Experience;

        /**
         * Encodes the specified Experience message. Does not implicitly {@link ProfileRes.Experience.verify|verify} messages.
         * @param message Experience message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: ProfileRes.IExperience, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified Experience message, length delimited. Does not implicitly {@link ProfileRes.Experience.verify|verify} messages.
         * @param message Experience message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: ProfileRes.IExperience, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes an Experience message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Experience
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): ProfileRes.Experience;

        /**
         * Decodes an Experience message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Experience
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): ProfileRes.Experience;

        /**
         * Verifies an Experience message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates an Experience message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Experience
         */
        public static fromObject(object: { [k: string]: any }): ProfileRes.Experience;

        /**
         * Creates a plain object from an Experience message. Also converts values to other types if specified.
         * @param message Experience
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: ProfileRes.Experience, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Experience to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Experience
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }
}
