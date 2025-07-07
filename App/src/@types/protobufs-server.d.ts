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
