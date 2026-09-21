import QRCode from 'qrcode';

/**
 * Generates a scannable QR code for an equipment item as a data URL. The
 * code carries only the item's QR identifier — never state — so scanning it
 * always resolves through the live equipment record rather than encoding a
 * status that could go stale the moment the asset moves.
 */
export async function generateEquipmentQrDataUrl(qrCode: string, baseUrl: string): Promise<string> {
  const scanUrl = `${baseUrl}/equipment/${qrCode}/scan`;
  return QRCode.toDataURL(scanUrl, { errorCorrectionLevel: 'M', margin: 2, width: 320 });
}
