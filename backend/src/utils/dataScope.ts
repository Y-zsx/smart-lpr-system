import { PlateGroup } from '../types';

interface Scope {
  all?: boolean;
  cameraIds?: string[];
  regionCodes?: string[];
}

function includeByScope(cameraId: string | undefined, regionCode: string | undefined, scope?: Scope): boolean {
  if (!scope || scope.all) return true;
  const cameraIds = scope.cameraIds || [];
  const regionCodes = scope.regionCodes || [];
  if (!cameraIds.length && !regionCodes.length) return false;
  const cameraOk = cameraId ? cameraIds.includes(cameraId) : false;
  const regionOk = regionCode ? regionCodes.includes(regionCode) : false;
  return cameraOk || regionOk;
}

export function filterPlateGroupsByScope(groups: PlateGroup[], scope?: Scope): PlateGroup[] {
  if (!scope || scope.all) return groups;

  const filtered = groups
    .map(group => {
      const records = group.records.filter(record =>
        includeByScope(record.cameraId, (record as any).regionCode, scope)
      );
      if (!records.length) return null;
      return {
        ...group,
        records,
        firstSeen: records[records.length - 1]?.timestamp || group.firstSeen,
        lastSeen: records[0]?.timestamp || group.lastSeen,
        totalCount: records.length,
        averageConfidence: records.reduce((sum, item) => sum + item.confidence, 0) / records.length,
        locations: [...new Set(records.map(r => r.location).filter(Boolean))] as string[],
        cameras: [...new Set(records.map(r => r.cameraName).filter(Boolean))] as string[]
      };
    })
    .filter(Boolean) as PlateGroup[];

  return filtered;
}

export function filterItemsByScope<T>(
  items: T[],
  getCameraId: (item: T) => string | undefined,
  getRegionCode?: (item: T) => string | undefined,
  scope?: Scope
): T[] {
  if (!scope || scope.all) return items;
  return items.filter(item => includeByScope(getCameraId(item), getRegionCode ? getRegionCode(item) : undefined, scope));
}

