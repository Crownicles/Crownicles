export interface FromClientPacket {}
import * as $protobuf from "protobufjs";
import Long = require("long");
/** Properties of a PingReq. */
export interface IPingReq extends FromClientPacket {
}

/** Represents a PingReq. */
export class PingReq implements IPingReq {

    /**
     * Constructs a new PingReq.
     * @param [properties] Properties to set
     */
    constructor(properties?: IPingReq);

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
