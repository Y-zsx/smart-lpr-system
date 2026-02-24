/**
 * 中国车牌格式校验：仅允许符合规范的车牌入库，避免 EAX0861 等非法格式被保存。
 * 规则与 ai-service 的 _looks_like_cn_plate 保持一致。
 */

const PROVINCE_PREFIXES = new Set(
  '京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼港澳使领学警'.split('')
);

const ALNUM_RE = /^[A-Z0-9]+$/;

/**
 * 判断字符串是否像中国车牌格式：
 * - 长度 7 或 8（新能源 8 位）
 * - 首字为省/直辖市/自治区简称
 * - 第二字为 A-Z
 * - 其余为字母或数字（无分隔符也可，如 京A12345）
 */
export function isValidChinesePlateNumber(plateNumber: string): boolean {
  if (!plateNumber || typeof plateNumber !== 'string') return false;
  const code = plateNumber.trim().toUpperCase().replace(/[\s·.\-_]/g, '');
  if (code.length !== 7 && code.length !== 8) return false;
  if (!PROVINCE_PREFIXES.has(code[0])) return false;
  if (code[1] < 'A' || code[1] > 'Z') return false;
  return ALNUM_RE.test(code.slice(2));
}
