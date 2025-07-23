export interface FromClientPacket {}
import * as $protobuf from "protobufjs";
import Long = require("long");
/** Properties of a PingReq. */
export interface IPingReq extends FromClientPacket {

    /** PingReq time */
    time: number;
}

/** Represents a PingReq. */
export class PingReq implements IPingReq {

    /**
     * Constructs a new PingReq.
     * @param [properties] Properties to set
     */
    constructor(properties?: IPingReq);

    /** PingReq time. */
    public time: number;

    /**
     * Creates a new PingReq instance using the specified properties.
     * @param [properties] Properties to set
     * @returns PingReq instance
     */
    public static create(properties?: IPingReq): PingReq;

    /**
     * Encodes the specified PingReq message. Does not implicitly {@link PingReq.verify|verify} messages.
     * @param message PingReq message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IPingReq, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified PingReq message, length delimited. Does not implicitly {@link PingReq.verify|verify} messages.
     * @param message PingReq message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IPingReq, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a PingReq message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns PingReq
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): PingReq;

    /**
     * Decodes a PingReq message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns PingReq
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): PingReq;

    /**
     * Verifies a PingReq message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a PingReq message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns PingReq
     */
    public static fromObject(object: { [k: string]: any }): PingReq;

    /**
     * Creates a plain object from a PingReq message. Also converts values to other types if specified.
     * @param message PingReq
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: PingReq, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this PingReq to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for PingReq
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a ProfileReq. */
export interface IProfileReq extends FromClientPacket {

    /** ProfileReq askedPlayer */
    askedPlayer: ProfileReq.IAskedPlayer;
}

/** Represents a ProfileReq. */
export class ProfileReq implements IProfileReq {

    /**
     * Constructs a new ProfileReq.
     * @param [properties] Properties to set
     */
    constructor(properties?: IProfileReq);

    /** ProfileReq askedPlayer. */
    public askedPlayer: ProfileReq.IAskedPlayer;

    /**
     * Creates a new ProfileReq instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ProfileReq instance
     */
    public static create(properties?: IProfileReq): ProfileReq;

    /**
     * Encodes the specified ProfileReq message. Does not implicitly {@link ProfileReq.verify|verify} messages.
     * @param message ProfileReq message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IProfileReq, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified ProfileReq message, length delimited. Does not implicitly {@link ProfileReq.verify|verify} messages.
     * @param message ProfileReq message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IProfileReq, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a ProfileReq message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ProfileReq
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): ProfileReq;

    /**
     * Decodes a ProfileReq message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ProfileReq
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): ProfileReq;

    /**
     * Verifies a ProfileReq message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a ProfileReq message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ProfileReq
     */
    public static fromObject(object: { [k: string]: any }): ProfileReq;

    /**
     * Creates a plain object from a ProfileReq message. Also converts values to other types if specified.
     * @param message ProfileReq
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: ProfileReq, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this ProfileReq to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for ProfileReq
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

export namespace ProfileReq {

    /** Properties of an AskedPlayer. */
    interface IAskedPlayer {

        /** AskedPlayer rank */
        rank?: (number|null);

        /** AskedPlayer keycloakId */
        keycloakId?: (string|null);
    }

    /** Represents an AskedPlayer. */
    class AskedPlayer implements IAskedPlayer {

        /**
         * Constructs a new AskedPlayer.
         * @param [properties] Properties to set
         */
        constructor(properties?: ProfileReq.IAskedPlayer);

        /** AskedPlayer rank. */
        public rank: number;

        /** AskedPlayer keycloakId. */
        public keycloakId: string;

        /**
         * Creates a new AskedPlayer instance using the specified properties.
         * @param [properties] Properties to set
         * @returns AskedPlayer instance
         */
        public static create(properties?: ProfileReq.IAskedPlayer): ProfileReq.AskedPlayer;

        /**
         * Encodes the specified AskedPlayer message. Does not implicitly {@link ProfileReq.AskedPlayer.verify|verify} messages.
         * @param message AskedPlayer message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: ProfileReq.IAskedPlayer, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified AskedPlayer message, length delimited. Does not implicitly {@link ProfileReq.AskedPlayer.verify|verify} messages.
         * @param message AskedPlayer message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: ProfileReq.IAskedPlayer, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes an AskedPlayer message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns AskedPlayer
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): ProfileReq.AskedPlayer;

        /**
         * Decodes an AskedPlayer message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns AskedPlayer
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): ProfileReq.AskedPlayer;

        /**
         * Verifies an AskedPlayer message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates an AskedPlayer message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns AskedPlayer
         */
        public static fromObject(object: { [k: string]: any }): ProfileReq.AskedPlayer;

        /**
         * Creates a plain object from an AskedPlayer message. Also converts values to other types if specified.
         * @param message AskedPlayer
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: ProfileReq.AskedPlayer, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this AskedPlayer to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for AskedPlayer
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }
}
