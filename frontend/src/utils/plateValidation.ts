/**
 * 中国车牌格式校验：非法格式（如 EAX0861）不展示、不入库。
 * 规则与 backend 及 ai-service 保持一致。
 */

const PROVINCE_PREFIXES = new Set(
  '京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼港澳使领学警'.split('')
);

const ALNUM_RE = /^[A-Z0-9]+$/;

/**
 * 判断是否为中国车牌格式：
 * - 长度 7 或 8（新能源 8 位）
 * - 首字为省/直辖市/自治区简称
 * - 第二字为 A-Z
 * - 其余为字母或数字
 */
export function isValidChinesePlateNumber(plateNumber: string): boolean {
  if (!plateNumber || typeof plateNumber !== 'string') return false;
  const code = plateNumber.trim().toUpperCase().replace(/[\s·.\-_]/g, '');
  if (code.length !== 7 && code.length !== 8) return false;
  if (!PROVINCE_PREFIXES.has(code[0])) return false;
  if (code[1] < 'A' || code[1] > 'Z') return false;
  return ALNUM_RE.test(code.slice(2));
}
