/**
 * Administrative areas of Murang'a County: sub-county -> wards (the 35 IEBC county assembly wards).
 *
 * NOTE: "Murang'a South" is an administrative sub-county inside Maragua constituency. We could not verify an
 * official ward-by-ward split between "Maragua" and "Murang'a South", so both list the six Maragua-constituency
 * wards. Edit this table if the county has the exact split.
 */
const MARAGUA_WARDS = ["Kimorori/Wempa", "Makuyu", "Kambiti", "Kamahuha", "Ichagaki", "Nginda"];

const SUBCOUNTY_WARDS = {
  Kiharu: ["Wangu", "Mugoiri", "Mbiri", "Township", "Murarandia", "Gaturi"],
  Kandara: ["Ng'araria", "Muruka", "Kagundu-ini", "Gaichanjiru", "Ithiru", "Ruchu"],
  Kigumo: ["Kahumbu", "Muthithi", "Kigumo", "Kangari", "Kinyona"],
  Kangema: ["Kanyenya-ini", "Muguru", "Rwathia"],
  Mathioya: ["Gitugi", "Kiru", "Kamacharia"],
  Gatanga: ["Ithanga", "Kakuzi/Mitubiri", "Mugumo-ini", "Kihumbu-ini", "Gatanga", "Kariara"],
  "Murang’a South": ["Kimorori/Wempa", "Makuyu", "Kambiti", "Kamahuha", "Ichagaki", "Nginda"],
};

const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const isValidLocation = (subCounty, ward) => has(SUBCOUNTY_WARDS, subCounty) && SUBCOUNTY_WARDS[subCounty].includes(ward);

module.exports = { SUBCOUNTY_WARDS, isValidLocation };
