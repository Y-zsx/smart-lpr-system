import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

// 配置高德地图安全密钥（必须在加载地图脚本之前设置）
const amapSecurityCode = import.meta.env.VITE_AMAP_SECURITY_CODE;
if (amapSecurityCode && amapSecurityCode !== 'your_amap_security_code_here') {
    (window as any)._AMapSecurityConfig = {
        securityJsCode: amapSecurityCode
    };
    console.log('高德地图安全密钥已配置');
}

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <App />
    </StrictMode>
);
