# AI Recognition Service

基于 Python + FastAPI + HyperLPR3 的车牌识别服务。

## 快速开始

```bash
pip install -r requirements.txt
python -m app.main
```

服务地址：http://localhost:8001

## 环境变量

- `AI_CORS_ORIGINS`：允许跨域来源，逗号分隔（默认：`http://localhost:5173,http://localhost:3000`）
- `PORT`：服务端口（默认：`8001`）
- `AI_ENABLE_PROVINCE_CONFLICT_RESOLVE`：是否启用“同尾号省份冲突消解”（默认：`false`）
- `AI_ENABLE_TEMPORAL_PROVINCE_VOTE`：是否启用“跨帧省份投票纠偏”（默认：`false`）
- `AI_NON_CN_MIN_CONFIDENCE_FLOOR`：非标准格式候选的最低置信度下限（默认：`0.75`，取值范围 `0~1`）
- `AI_VARIANT_PROFILE`：预处理分支策略（`native` | `balanced` | `aggressive`，默认：`native`）
  - `native`：仅原图识别（推荐，最贴近模型原生用法）
  - `balanced`：原图 + 轻增强（低照补偿）
  - `aggressive`：原图 + 强增强 + 缩放 + 旋转（更激进，可能引入误检）
- `AI_BOX_IOU_MERGE_THRESHOLD`：同位置候选合并 IoU 阈值（默认：`0.35`，可调低到 `0.2` 降低“一车多牌”）
- 示例（Windows PowerShell）：

```bash
set AI_CORS_ORIGINS=http://localhost:5173,https://your-domain.com
set AI_ENABLE_PROVINCE_CONFLICT_RESOLVE=false
set AI_ENABLE_TEMPORAL_PROVINCE_VOTE=false
set AI_NON_CN_MIN_CONFIDENCE_FLOOR=0.75
set AI_VARIANT_PROFILE=native
set AI_BOX_IOU_MERGE_THRESHOLD=0.2
python -m app.main
```

示例（Linux/macOS）：

```bash
export AI_CORS_ORIGINS="http://localhost:5173,https://your-domain.com"
export AI_ENABLE_PROVINCE_CONFLICT_RESOLVE=false
export AI_ENABLE_TEMPORAL_PROVINCE_VOTE=false
export AI_NON_CN_MIN_CONFIDENCE_FLOOR=0.75
export AI_VARIANT_PROFILE=native
export AI_BOX_IOU_MERGE_THRESHOLD=0.2
export PORT=8001
python -m app.main
```

## 目录结构

- `app/` — 服务核心（main.py）；`evaluation/` — 评估脚本（evaluate.py）
- 启动服务：`python -m app.main`
- 启动评估：`python -m evaluation.evaluate --ground-truth <gt.json> --predictions <pred.json>`

## API

**健康检查**：GET /health

**车牌识别**：POST /recognize（multipart/form-data，字段 file）

可选 Query：`min_confidence`（最低置信度）、`max_plates`（最多返回数量，0 不限制）。示例：`POST /recognize?min_confidence=0.5&max_plates=5`

响应示例：
```json
{
  "plates": [
    { "number": "京A·12345", "type": "blue", "confidence": 0.95, "rect": {"x": 100, "y": 100, "w": 200, "h": 100} }
  ]
}
```

## 车牌类型与说明

- 类型：blue（蓝牌）、yellow（黄牌）、green（绿牌）、white（白牌）、black（黑牌）
- 多车牌：单图返回所有检测车牌，按从上到下、从左到右排序；可用 `max_plates` 限制数量。
- 准确率：使用高分辨率检测（如 640×640），`min_confidence` 可过滤低置信度。

## 技术栈与注意

- Python 3.8+、FastAPI、HyperLPR3、OpenCV
- 图片需车牌清晰；建议分辨率不低于 640×480；效果受光照、角度、遮挡影响。
