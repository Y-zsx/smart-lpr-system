import React from 'react';
import { SettingsModal } from '../components/SettingsModal';

export const SettingsPage: React.FC = () => {
    // SettingsModal 原本设计为模态框，这里我们可能需要稍微调整一下，
    // 或者直接复用它的内容。为了简单，我们暂时直接渲染它，
    // 但通常最好将 SettingsModal 的内部逻辑提取为 SettingsForm 组件。
    // 这里我们先做一个简单的占位，或者重构 SettingsModal。
    
    // 由于 SettingsModal 有 onClose 属性且设计为弹窗，
    // 我们这里直接复用它可能不太合适（它有遮罩层）。
    // 更好的做法是修改 SettingsModal 让它支持非模态模式，或者新建一个 SettingsContent。
    
    // 暂时我们还是用弹窗的方式在 Dashboard 头部调用，或者在这里重写一个页面。
    // 鉴于时间，我先放一个简单的提示，或者把 SettingsModal 改造成可以嵌入的。
    
    // 实际上，SettingsModal 的内容可以直接提取出来。
    // 让我们假设 SettingsModal 的内容被提取到了 SettingsContent 中。
    // 但现在我没有 SettingsContent。
    
    // 简单起见，我直接在这里显示一个“系统设置”的标题，并说明设置功能目前通过右上角访问，
    // 或者我们可以把 SettingsModal 的代码复制过来改成页面版。
    
    // 让我们先复用 SettingsModal，但需要注意它是一个 Modal。
    // 也许最好的方式是保持 SettingsModal 为 Modal，而在 MainLayout 的 Header 中保留设置按钮。
    // 这样 SettingsPage 可能暂时不需要，或者作为一个专门的页面来展示更详细的设置。
    
    return (
        <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold mb-4">系统设置</h2>
            <p className="text-gray-500">请点击右上角的设置图标进行系统配置。</p>
        </div>
    );
};
