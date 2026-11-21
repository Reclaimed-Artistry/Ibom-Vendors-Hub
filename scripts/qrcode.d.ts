declare module "qrcode" {
  export function toBuffer(
    text: string,
    options?: {
      type?: string;
      width?: number;
      margin?: number;
      color?: { dark: string; light: string };
      errorCorrectionLevel?: "L" | "M" | "Q" | "H";
    },
  ): Promise<Buffer>;
}
