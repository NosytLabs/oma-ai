declare module "bs58" {
  const bs58: {
    encode: (buffer: Buffer | number[]) => string;
    decode: (string: string) => Buffer;
  };
  export default bs58;
}