/*
 * Gera o código Pix "copia e cola" (BR Code / EMV, padrão do Banco Central)
 * com valor e identificador do pedido.
 */
window.AGPix = (function () {
  const field = (id, value) => id + String(value.length).padStart(2, "0") + value;

  // Nome e cidade: sem acento, só caracteres aceitos, em maiúsculas
  const plain = (text, max) =>
    String(text || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9 ]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase()
      .slice(0, max);

  function crc16(payload) {
    let crc = 0xffff;
    for (let i = 0; i < payload.length; i++) {
      crc ^= payload.charCodeAt(i) << 8;
      for (let bit = 0; bit < 8; bit++) {
        crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
        crc &= 0xffff;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, "0");
  }

  function payload({ key, name, city, amount, txid }) {
    const account = field("00", "br.gov.bcb.pix") + field("01", String(key).trim());
    const ref = String(txid || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";
    let code =
      field("00", "01") +
      field("26", account) +
      field("52", "0000") +
      field("53", "986") +
      (amount > 0 ? field("54", Number(amount).toFixed(2)) : "") +
      field("58", "BR") +
      field("59", plain(name, 25) || "LOJA") +
      field("60", plain(city, 15) || "BARUERI") +
      field("62", field("05", ref)) +
      "6304";
    return code + crc16(code);
  }

  return { payload, crc16 };
})();
