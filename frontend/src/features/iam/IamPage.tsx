import React, { useEffect, useMemo, useState } from 'react';
import { apiClient, DataScope } from '@/api/client';
import { useToastContext } from '@/contexts/ToastContext';

interface IamUser {
    id: string;
    username: string;
    displayName: string;
    status: string;
    roles: string[];
}

interface IamRole {
    id: string;
    roleKey: string;
    roleName: string;
    description?: string;
    permissions: string[];
    dataScope: DataScope;
}

interface IamPermission {
    id: string;
    key: string;
    name: string;
    group: string;
}

interface CameraOption {
    id: string;
    name: string;
    regionCode?: string;
}

export const IamPage: React.FC = () => {
    const toast = useToastContext();
    const [users, setUsers] = useState<IamUser[]>([]);
    const [roles, setRoles] = useState<IamRole[]>([]);
    const [permissions, setPermissions] = useState<IamPermission[]>([]);
    const [cameraOptions, setCameraOptions] = useState<CameraOption[]>([]);
    const [activeRoleKey, setActiveRoleKey] = useState<string>('');
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        setLoading(true);
        try {
            const [u, r, p, c] = await Promise.all([
                apiClient.getIamUsers(),
                apiClient.getIamRoles(),
                apiClient.getIamPermissions(),
                apiClient.getCameras()
            ]);
            const cameras = Array.isArray(c)
                ? c
                : (c && typeof c === 'object' && 'data' in c && Array.isArray((c as { data?: unknown }).data))
                    ? ((c as { data: unknown[] }).data)
                    : [];
            setUsers(u);
            setRoles(r);
            setPermissions(p);
            setCameraOptions(
                cameras
                    .filter((item): item is { id: string; name?: string; regionCode?: string } => Boolean(item?.id))
                    .map(item => ({
                        id: item.id,
                        name: item.name || item.id,
                        regionCode: item.regionCode
                    }))
            );
            if (!activeRoleKey && r.length) setActiveRoleKey(r[0].roleKey);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : '加载权限配置失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const groupedPermissions = useMemo(() => {
        const map = new Map<string, IamPermission[]>();
        permissions.forEach((item) => {
            if (!map.has(item.group)) map.set(item.group, []);
            map.get(item.group)!.push(item);
        });
        return Array.from(map.entries());
    }, [permissions]);

    const activeRole = roles.find(r => r.roleKey === activeRoleKey);
    const cameraMap = useMemo(() => {
        return new Map(cameraOptions.map(camera => [camera.id, camera]));
    }, [cameraOptions]);

    const availableCameraOptions = useMemo(() => {
        if (!activeRole) return [];
        return cameraOptions.filter(camera => !activeRole.dataScope.cameraIds.includes(camera.id));
    }, [activeRole, cameraOptions]);

    const buildRegionCodesByCameraIds = (cameraIds: string[]) => {
        return Array.from(
            new Set(
                cameraIds
                    .map(cameraId => cameraMap.get(cameraId)?.regionCode?.trim())
                    .filter((regionCode): regionCode is string => Boolean(regionCode))
            )
        );
    };

    const toggleUserRole = async (user: IamUser, roleKey: string) => {
        const nextRoles = user.roles.includes(roleKey)
            ? user.roles.filter(r => r !== roleKey)
            : [...user.roles, roleKey];
        try {
            await apiClient.setUserRoles(user.id, nextRoles);
            setUsers(prev => prev.map(u => u.id === user.id ? { ...u, roles: nextRoles } : u));
            toast.success('用户角色已更新');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : '更新失败');
        }
    };

    const toggleRolePermission = async (permissionKey: string) => {
        if (!activeRole) return;
        const next = activeRole.permissions.includes(permissionKey)
            ? activeRole.permissions.filter(p => p !== permissionKey)
            : [...activeRole.permissions, permissionKey];
        try {
            await apiClient.setRolePermissions(activeRole.roleKey, next);
            setRoles(prev => prev.map(r => r.roleKey === activeRole.roleKey ? { ...r, permissions: next } : r));
            toast.success('角色权限已更新');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : '更新失败');
        }
    };

    const updateRoleScope = async (scope: DataScope) => {
        if (!activeRole) return;
        try {
            await apiClient.setRoleDataScope(activeRole.roleKey, scope);
            setRoles(prev => prev.map(r => r.roleKey === activeRole.roleKey ? { ...r, dataScope: scope } : r));
            toast.success('数据范围已更新');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : '更新失败');
        }
    };

    const addCameraToScope = async (cameraId: string) => {
        if (!activeRole || !cameraId) return;
        const nextCameraIds = Array.from(new Set([...activeRole.dataScope.cameraIds, cameraId]));
        await updateRoleScope({
            ...activeRole.dataScope,
            all: false,
            cameraIds: nextCameraIds,
            regionCodes: buildRegionCodesByCameraIds(nextCameraIds)
        });
    };

    const removeCameraFromScope = async (cameraId: string) => {
        if (!activeRole) return;
        const nextCameraIds = activeRole.dataScope.cameraIds.filter(id => id !== cameraId);
        await updateRoleScope({
            ...activeRole.dataScope,
            all: false,
            cameraIds: nextCameraIds,
            regionCodes: buildRegionCodesByCameraIds(nextCameraIds)
        });
    };

    if (loading) {
        return <div className="p-6 bg-white rounded-xl border border-gray-100">加载权限配置中...</div>;
    }

    return (
        <div className="space-y-4">
            <div className="p-4 bg-white border border-gray-100 rounded-xl">
                <h2 className="text-lg font-bold text-gray-800">人员权限管理</h2>
                <p className="text-sm text-gray-500 mt-1">支持用户-角色-权限及摄像头/区域数据范围配置。</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="p-4 bg-white border border-gray-100 rounded-xl">
                    <h3 className="font-semibold text-gray-800 mb-3">用户角色分配</h3>
                    <div className="space-y-3">
                        {users.map(user => (
                            <div key={user.id} className="p-3 border border-gray-100 rounded-lg">
                                <div className="text-sm font-medium text-gray-800">{user.displayName} ({user.username})</div>
                                <div className="flex gap-2 mt-2 flex-wrap">
                                    {roles.map(role => {
                                        const checked = user.roles.includes(role.roleKey);
                                        return (
                                            <button
                                                key={role.roleKey}
                                                onClick={() => toggleUserRole(user, role.roleKey)}
                                                className={`px-2 py-1 text-xs rounded border ${checked ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}
                                            >
                                                {role.roleName}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-4 bg-white border border-gray-100 rounded-xl">
                    <h3 className="font-semibold text-gray-800 mb-3">角色权限配置</h3>
                    <div className="flex gap-2 mb-3 flex-wrap">
                        {roles.map(role => (
                            <button
                                key={role.roleKey}
                                onClick={() => setActiveRoleKey(role.roleKey)}
                                className={`px-3 py-1.5 text-sm rounded-lg ${activeRoleKey === role.roleKey ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                            >
                                {role.roleName}
                            </button>
                        ))}
                    </div>

                    {activeRole && (
                        <>
                            <div className="mb-3 text-sm text-gray-600">{activeRole.description}</div>
                            <div className="space-y-2 max-h-72 sm:max-h-80 overflow-auto">
                                {groupedPermissions.map(([group, items]) => (
                                    <div key={group} className="border border-gray-100 rounded p-2">
                                        <div className="text-xs text-gray-500 mb-1">{group}</div>
                                        <div className="flex gap-2 flex-wrap">
                                            {items.map(perm => {
                                                const checked = activeRole.permissions.includes(perm.key);
                                                return (
                                                    <button
                                                        key={perm.key}
                                                        onClick={() => toggleRolePermission(perm.key)}
                                                        className={`px-2 py-1.5 text-xs rounded border ${checked ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-200'}`}
                                                    >
                                                        {perm.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-4 p-3 border border-gray-100 rounded">
                                <div className="text-sm font-medium text-gray-700 mb-2">数据范围</div>
                                <div className="flex gap-2 items-center flex-wrap">
                                    <button
                                        onClick={() => updateRoleScope({ all: true, cameraIds: [], regionCodes: [] })}
                                        className={`px-2 py-1 text-xs rounded ${activeRole.dataScope.all ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                                    >
                                        全量数据
                                    </button>
                                    <button
                                        onClick={() => updateRoleScope({ ...activeRole.dataScope, all: false })}
                                        className={`px-2 py-1 text-xs rounded ${!activeRole.dataScope.all ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                                    >
                                        指定范围
                                    </button>
                                </div>
                                {!activeRole.dataScope.all && (
                                    <div className="mt-3 space-y-2 text-xs text-gray-500">
                                        <div>
                                            <label className="text-xs text-gray-600">可见摄像头</label>
                                            <select
                                                className="mt-1 w-full px-2 py-1.5 border border-gray-200 rounded bg-white text-xs text-gray-700"
                                                value=""
                                                onChange={(e) => {
                                                    addCameraToScope(e.target.value);
                                                    e.currentTarget.value = '';
                                                }}
                                            >
                                                <option value="" disabled>选择摄像头加入数据范围</option>
                                                {availableCameraOptions.map(camera => (
                                                    <option key={camera.id} value={camera.id}>
                                                        {camera.name}{camera.regionCode ? ` (${camera.regionCode})` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex gap-1.5 flex-wrap">
                                            {activeRole.dataScope.cameraIds.length ? activeRole.dataScope.cameraIds.map(cameraId => (
                                                <button
                                                    key={cameraId}
                                                    onClick={() => removeCameraFromScope(cameraId)}
                                                    className="px-2 py-1 rounded-full border border-blue-200 bg-blue-50 text-blue-700"
                                                    title="点击移除"
                                                >
                                                    {(cameraMap.get(cameraId)?.name || cameraId)} ×
                                                </button>
                                            )) : <span>未设置摄像头</span>}
                                        </div>
                                        <div>
                                            区域: {activeRole.dataScope.regionCodes.join(', ') || '未设置'}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
