# AI Recognition Service

基于 Python + FastAPI + HyperLPR3 的车牌识别服务。

## 快速开始

```bash
pip install -r requirements.txt
python main.py
```

服务地址：http://localhost:8001

## 目录结构

- `app/` — 服务核心（main.py）；`evaluation/` — 评估脚本（evaluate.py）
- `main.py`、`evaluation.py` 为兼容入口，委托到上述目录。原有 `python main.py`、`python evaluation.py` 用法不变。

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
