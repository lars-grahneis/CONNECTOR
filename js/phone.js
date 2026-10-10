// Telefonnummer in das Format für wa.me-Links bringen (nur Ziffern, mit Ländervorwahl).
export function waNumber(phone, countryCode = '49') {
  if (!phone) return '';
  let p = String(phone).replace(/[^\d+]/g, '');
  if (p.startsWith('+')) return p.slice(1).replace(/\D/g, '');
  if (p.startsWith('00')) return p.slice(2);
  if (p.startsWith('0')) return String(countryCode).replace(/\D/g, '') + p.slice(1);
  return p;
}
