from fastapi import FastAPI, File, UploadFile, Query
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import hyperlpr3 as lpr3
import cv2
import numpy as np
import io

# 使用高精度检测 (640x640)，提高小目标、多车牌场景的准确率
try:
    from hyperlpr3.common.typedef import DETECT_LEVEL_HIGH
except ImportError:
    DETECT_LEVEL_HIGH = 1

app = FastAPI()

# 添加 CORS 中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],  # 前端地址
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize HyperLPR3：detect_level=HIGH(640x640) 提升准确率，尤其多车牌、远距离
catcher = lpr3.LicensePlateCatcher(detect_level=DETECT_LEVEL_HIGH)

# 与 hyperlpr3.common.typedef 对齐的车牌类型
_PLATE_TYPE_MAP = {
    0: "blue",    # BLUE
    1: "yellow",  # YELLOW_SINGLE
    2: "white",   # WHILE_SINGLE 军/警
    3: "green",   # GREEN 新能源
    4: "black",   # BLACK_HK_MACAO
    5: "yellow",  # HK_SINGLE
    6: "yellow",  # HK_DOUBLE
    7: "yellow",  # MACAO_SINGLE
    8: "yellow",  # MACAO_DOUBLE
    9: "yellow",  # YELLOW_DOUBLE
}

@app.get("/health")
async def health():
    """健康检查端点"""
    return {"status": "online", "service": "AI Recognition Service"}

@app.post("/recognize")
async def recognize(
    file: UploadFile = File(...),
    min_confidence: float = Query(0.0, ge=0, le=1, description="最低置信度过滤，低于此值不返回"),
    max_plates: int = Query(0, ge=0, description="最多返回数量，0 表示不限制"),
):
    """
    识别图片中的车牌，支持多车牌。
    - 多车牌：HyperLPR3 会返回所有检测到的车牌，按从上到下、从左到右排序。
    - min_confidence：过滤低置信度结果。
    - max_plates：限制返回数量，便于业务层限流。
    """
    try:
        # Read image file
        contents = await file.read()
        if not contents or len(contents) == 0:
            return {"error": "Empty file uploaded", "plates": []}
        
        nparr = np.frombuffer(contents, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            return {"error": "Failed to decode image. Please ensure the file is a valid image format.", "plates": []}

        print(f"Image shape: {image.shape}, Processing recognition...")

        # Run recognition；catcher 返回 [code, confidence, type_idx, box] 的列表，天然支持多车牌
        results = catcher(image)
        
        print(f"Recognition results count: {len(results)}")
        
        plates = []
        for code, confidence, type_idx, box in results:
            if confidence < min_confidence:
                continue
            # box is [x1, y1, x2, y2]
            x1, y1, x2, y2 = box
            w = x2 - x1
            h = y2 - y1
            
            print(f"Detected plate: {code}, confidence: {confidence}, type_idx: {type_idx}")
            
            plate_type = _PLATE_TYPE_MAP.get(type_idx, "blue")
            if plate_type == "blue" and len(code) == 8:
                plate_type = "green"

            plates.append({
                "number": code,
                "confidence": float(confidence),
                "type": plate_type,
                "rect": {"x": int(x1), "y": int(y1), "w": int(w), "h": int(h)},
            })

        # 多车牌按从上到下、从左到右排序，便于前端/业务展示
        plates.sort(key=lambda p: (p["rect"]["y"], p["rect"]["x"]))
        if max_plates > 0:
            plates = plates[:max_plates]

        print(f"Returning {len(plates)} plates")
        return {"plates": plates}

    except Exception as e:
        import traceback
        error_msg = str(e)
        traceback.print_exc()
        print(f"Error in recognition: {error_msg}")
        return {"error": error_msg, "plates": []}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
