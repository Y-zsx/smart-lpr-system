# AI Recognition Service

基于 Python + FastAPI + HyperLPR3 的智能车牌识别服务。

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

**响应示例：**
```json
{
  "success": true,
  "plates": [{
    "number": "京A·12345",
    "type": "blue",
    "confidence": 0.95,
    "rect": {"x": 100, "y": 100, "w": 200, "h": 100}
  }]
}
```

## 🚗 支持的车牌类型

- **蓝牌** (blue) - 普通小型汽车
- **黄牌** (yellow) - 大型汽车、货车
- **绿牌** (green) - 新能源汽车
- **白牌** (white) - 军车、警车
- **黑牌** (black) - 外籍车辆

## 🛠️ 技术栈

- **Python 3.8+**
- **FastAPI** - Web 框架
- **HyperLPR3** - 车牌识别算法
- **OpenCV** - 图像处理

## ⚠️ 注意事项

- 确保图片中车牌清晰可见
- 建议图片分辨率不低于 640x480
- 识别效果受光照、角度等因素影响
