/**
 * Escapes user input so it can be embedded in a RegExp / Mongo $regex as a literal string,
 * preventing regex injection and ReDoS. Input is length-capped.
 */
export const escapeRegex = (value, maxLength = 100) =>
  String(value ?? '').slice(0, maxLength).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export default escapeRegex;
