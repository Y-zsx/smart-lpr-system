# AI Recognition Service (AI 识别服务)

基于 Python + FastAPI + HyperLPR3 构建的智能车牌识别服务。

## 功能特性

- **高精度识别**：基于 HyperLPR3 深度学习算法，支持多种车牌类型
- **RESTful API**：提供标准的 HTTP 接口供后端调用
- **图片处理**：支持多种图片格式，自动预处理和优化
- **实时识别**：低延迟识别，适合实时监控场景

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

服务将在 `http://localhost:8001` 启动。

## API 接口

### 健康检查

```http
GET /health
```

返回服务状态。

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
  "plates": [
    {
      "number": "京A·12345",
      "type": "blue",
      "confidence": 0.95,
      "rect": {
        "x": 100,
        "y": 100,
        "w": 200,
        "h": 100
      }
    }
  ]
}
```

## 支持的车牌类型

- **蓝牌** (blue) - 普通小型汽车
- **黄牌** (yellow) - 大型汽车、货车
- **绿牌** (green) - 新能源汽车
- **白牌** (white) - 军车、警车
- **黑牌** (black) - 外籍车辆

## 技术栈

- **Python 3.8+** - 编程语言
- **FastAPI** - Web 框架
- **HyperLPR3** - 车牌识别算法
- **OpenCV** - 图像处理
- **NumPy** - 数值计算

## 性能优化

- 使用 HyperLPR3 的高性能识别引擎
- 支持批量识别（未来版本）
- 自动图片预处理和优化

## 注意事项

- 确保图片中车牌清晰可见
- 建议图片分辨率不低于 640x480
- 识别效果受光照、角度等因素影响
