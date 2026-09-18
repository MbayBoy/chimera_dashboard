/** Types for the generated GPS-tagged JPEG fixture helper. */
export declare function buildExifWithGps(): Buffer;
export declare function injectExif(jpeg: Buffer, exif: Buffer): Buffer;
export declare function makeGpsTaggedJpeg(): Promise<Buffer>;
