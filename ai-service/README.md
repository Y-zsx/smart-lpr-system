# AI Recognition Service

基于 Python + FastAPI + **HyperLPR3** 的智能车牌识别服务。

## 🚀 快速开始

```bash
# 安装依赖
pip install -r requirements.txt

# 启动服务
python main.py
```

服务运行在 `http://localhost:8001`

## 🔌 API 接口

### 健康检查

```http
GET /health
```

### 车牌识别

```http
POST /recognize
Content-Type: multipart/form-data

file: <图片文件>
```

**Query 参数（可选）：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `min_confidence` | float | 0 | 最低置信度，低于此值的结果不返回 |
| `max_plates` | int | 0 | 最多返回的车牌数量，0 表示不限制 |

**示例：**  
`POST /recognize?min_confidence=0.5&max_plates=5`

**响应示例：**
```json
{
  "plates": [
    {
      "number": "京A·12345",
      "type": "blue",
      "confidence": 0.95,
      "rect": {"x": 100, "y": 100, "w": 200, "h": 100}
    },
    {
      "number": "京B·67890",
      "type": "green",
      "confidence": 0.88,
      "rect": {"x": 400, "y": 120, "w": 200, "h": 100}
    }
  ]
}
```

## 🚗 支持的车牌类型

- **蓝牌** (blue) - 普通小型汽车
- **黄牌** (yellow) - 大型汽车、货车、双层黄牌等
- **绿牌** (green) - 新能源汽车
- **白牌** (white) - 军车、警车
- **黑牌** (black) - 港澳等黑牌

## 📐 多车牌与准确率

- **多车牌**：单张图片中会检测并返回**所有**车牌，按**从上到下、从左到右**排序。可通过 `max_plates` 限制返回数量。
- **准确率**：
  - 使用 **DETECT_LEVEL_HIGH**（640×640 检测），比默认 320×320 更适合多车牌、小目标、远距离场景。
  - 可通过 `min_confidence` 过滤低置信度结果，减少误检。

## 🛠️ 技术栈

- **Python 3.8+**
- **FastAPI** - Web 框架
- **HyperLPR3** - 车牌检测与识别（ONNX）
- **OpenCV** - 图像处理

## ⚠️ 注意事项

- 确保图片中车牌清晰可见
- 建议图片分辨率不低于 640×480，高分辨率利于多车牌与远距离
- 识别效果受光照、角度、遮挡等因素影响
