/**
 * 移动设备功能模块 (WebView 和 Web 环境)
 *
 * 该模块提供了一套统一的 API 来访问移动设备功能，
 * 采用“原生优先，Web 回退”的策略，以确保最佳的兼容性。
 */

/**
 * 检测是否运行在 React Native WebView 环境中
 *
 * @returns {boolean} 如果在 WebView 中返回 true，如果在普通浏览器中返回 false
 *
 * 使用场景:
 * - 在调用原生 API 之前进行功能检测
 * - 针对 WebView 和 Web 渲染不同的 UI
 * - 针对不同环境进行数据埋点
 *
 * @example
 * if (isInWebView()) {
 *   // 使用原生功能
 *   await callNative('hapticFeedback', { type: 'medium' });
 * } else {
 *   // 使用 Web 回退方案
 *   console.log('运行在普通浏览器中');
 * }
 */
export const isInWebView = () => !!(window as any).inAppWebview;

/**
 * 从 WebView 调用 React Native 原生方法
 *
 * @param {string} type - 要调用的原生方法名称
 * @param {any} [data] - 传递给原生方法的可选数据
 * @returns {Promise<any>} 返回原生响应的 Promise
 *
 * 使用场景:
 * - 请求设备权限（相机、运动传感器等）
 * - 访问原生独有功能（触感反馈、高级震动）
 * - 获取 Web API 无法提供的设备信息
 * - 触发原生 UI 组件（弹窗、选择器等）
 *
 * @example
 * // 请求原生触感反馈
 * await callNative('hapticFeedback', { type: 'heavy' });
 *
 * // 获取设备信息
 * const deviceInfo = await callNative('getDeviceInfo');
 *
 * // 请求相机权限（无用户提示）
 * const result = await callNative('requestCameraPermission');
 */
export const callNative = (type: string, data?: any): Promise<any> => {
    return new Promise((resolve, reject) => {
        if (!isInWebView()) {
            reject(new Error("Not in WebView"));
            return;
        }

        const requestId = `${Date.now()}_${Math.random()
            .toString(36)
            .substr(2, 9)}`;

        // 存储回调以便处理异步响应
        (window as any)._nativeCallbacks = (window as any)._nativeCallbacks || {};
        (window as any)._nativeCallbacks[requestId] = { resolve, reject };

        // 发送消息给 React Native 桥接器
        (window as any).inAppWebview.postMessage(
            JSON.stringify({ type, data, requestId })
        );

        // 3秒后超时，防止 Promise 永久挂起
        setTimeout(() => {
            if ((window as any)._nativeCallbacks[requestId]) {
                delete (window as any)._nativeCallbacks[requestId];
                reject(new Error("原生调用超时"));
            }
        }, 3000);
    });
};

/**
 * 处理来自 React Native 原生代码的响应
 * 这是由 WebView 桥接器自动调用的 - 请勿直接调用
 *
 * @internal
 */
if (typeof window !== "undefined") {
    (window as any).handleNativeResponse = (response: {
        requestId: string;
        success: boolean;
        data?: any;
        error?: string;
    }) => {
        const callback = (window as any)._nativeCallbacks?.[response.requestId];
        if (callback) {
            if (response.success) {
                callback.resolve(response.data);
            } else {
                callback.reject(new Error(response.error || "Native call failed"));
            }
            delete (window as any)._nativeCallbacks[response.requestId];
        }
    };
}

// ========== 媒体 API (WebKit 标准) ==========
/**
 * 从活动视频流中捕获照片
 *
 * @param {HTMLVideoElement} videoElement - 显示相机流的视频元素
 * @returns {string} Base64 编码的 JPEG 图像数据 URL
 *
 * 使用场景:
 * - 相机应用中的拍照功能
 * - 从视频流中截取帧
 * - 创建视频缩略图
 * - 文档/ID 扫描应用
 *
 * @example
 * // 设置相机流
 * const stream = await requestCamera('environment');
 * videoElement.srcObject = stream;
 *
 * // 用户点击按钮时拍照
 * const photoDataURL = capturePhoto(videoElement);
 * imgElement.src = photoDataURL;
 */
export const capturePhoto = (videoElement: HTMLVideoElement): string => {
    const canvas = document.createElement("canvas");
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx?.drawImage(videoElement, 0, 0);

    return canvas.toDataURL("image/jpeg", 0.8);
};

/**
 * 保存图片到设备相册 (WebView) 或下载文件夹 (Web)
 * 采用原生优先策略以获得更好的移动端集成体验
 *
 * @param dataURL - Base64 图片数据 URL (例如: "data:image/jpeg;base64,/9j/4AAQ...")
 * @param filename - 包含扩展名的文件名 (例如: "photo.jpg", "image.png")
 * @returns Promise 解析为 true 表示保存成功，false 表示失败
 *
 * 使用场景:
 * - 将拍摄的照片保存到设备相册 (WebView) 或下载 (Web)
 * - 导出生成的图片/图表
 * - 保存编辑后的图片或截图
 * - 存储二维码以供离线使用
 *
 * @example
 * // 保存拍摄的照片到相册/下载
 * const photoData = capturePhoto(videoElement);
 * const saved = await saveImageToDevice(photoData, 'my-photo.jpg');
 * if (saved) {
 *   console.log('照片保存成功！');
 * }
 *
 * // 保存画布绘制内容
 * const canvasData = canvas.toDataURL('image/png');
 * await saveImageToDevice(canvasData, 'drawing.png');
 */
export const saveImageToDevice = async (
    dataURL: string,
    filename = "photo.jpg"
): Promise<boolean> => {
    if (isInWebView()) {
        // 使用原生桥接保存到设备相册
        try {
            await callNative("saveImageToGallery", {
                dataURL, // 完整的 Data URL，包含 MIME 类型: "data:image/jpeg;base64,..."
                filename,
            });
            return true;
        } catch (error) {
            console.warn(
                "原生相册保存失败，回退到下载模式:",
                error
            );
            // 如果原生失败，回退到 Web 下载
        }
    }

    // Web 下载回退方案 (浏览器)
    try {
        const link = document.createElement("a");
        link.download = filename;
        link.href = dataURL;
        document.body.appendChild(link); // Firefox 需要
        link.click();
        document.body.removeChild(link);
        return true;
    } catch (error) {
        console.error("保存图片失败:", error);
        return false;
    }
};

// ========== 原生增强功能 ==========

/**
 * 触发设备震动，支持自定义模式
 * 原生实现比 Web API 提供更好的 iOS 支持
 *
 * @param {(number|number[])} [pattern=100] - 震动模式（毫秒）
 *   - 单个数字: 震动指定时长
 *   - 数组: 交替的震动/暂停时长 [震动, 暂停, 震动, 暂停, ...]
 *
 * 使用场景:
 * - 按钮点击的用户反馈
 * - 通知提醒
 * - 游戏效果（爆炸、碰撞）
 * - 无障碍反馈
 * - 闹钟/计时器通知
 *
 * @example
 * // 简单的短震动
 * vibrate(200);
 *
 * // 自定义模式: 震动 100ms, 暂停 50ms, 震动 200ms
 * vibrate([100, 50, 200]);
 *
 * // 摩尔斯电码 SOS 模式
 * vibrate([100,50, 100,50, 100,100, 200,50, 200,50, 200,100, 100,50, 100,50, 100]);
 */
export const vibrate = (pattern: number | number[] = 100) => {
    if (isInWebView()) {
        // 使用原生震动以获得更好的 iOS 支持和模式准确性
        callNative("vibrate", { pattern });
        return;
    }

    // Web API 回退方案 (适用于 Android 浏览器，iOS 支持有限)
    if ("vibrate" in navigator) {
        navigator.vibrate(pattern);
    }
};

/**
 * 触发不同强度的触感反馈 (iOS 风格)
 * 仅在原生 WebView 环境中可用 - 无 Web 回退方案
 *
 * @param {("light"|"medium"|"heavy")} [type="medium"] - 触感反馈强度
 *   - "light": 轻微反馈，用于次要交互
 *   - "medium": 标准反馈，用于常规交互
 *   - "heavy": 强力反馈，用于重要交互
 *
 * 使用场景:
 * - iOS 风格的系统反馈
 * - 选择确认
 * - 错误通知
 * - 成功确认
 * - 高级应用交互体验
 *
 * @example
 * // 悬停/选择时的轻微反馈
 * hapticFeedback('light');
 *
 * // 按钮点击时的中等反馈
 * hapticFeedback('medium'); // 或者直接 hapticFeedback()
 *
 * // 错误/重要操作时的强力反馈
 * hapticFeedback('heavy');
 *
 * // React 组件中的示例
 * const handleButtonPress = () => {
 *   hapticFeedback('medium');
 *   // ... 处理按钮操作
 * };
 */
export const hapticFeedback = (
    type: "light" | "medium" | "heavy" = "medium"
) => {
    if (isInWebView()) {
        callNative("hapticFeedback", { type });
    }
    // 无 Web 回退 - 触感反馈是原生独有功能
};
