from fastapi import FastAPI, File, UploadFile, Query
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import hyperlpr3 as lpr3
import cv2
import numpy as np

# 使用高精度检测 (640x640)，提高小目标、多车牌场景的准确率
try:
    from hyperlpr3.common.typedef import DETECT_LEVEL_HIGH
except ImportError:
    DETECT_LEVEL_HIGH = 1

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

catcher = lpr3.LicensePlateCatcher(detect_level=DETECT_LEVEL_HIGH)

_PLATE_TYPE_MAP = {
    0: "blue",
    1: "yellow",
    2: "white",
    3: "green",
    4: "black",
    5: "yellow",
    6: "yellow",
    7: "yellow",
    8: "yellow",
    9: "yellow",
}


@app.get("/health")
async def health():
    return {"status": "online", "service": "AI Recognition Service"}


@app.post("/recognize")
async def recognize(
    file: UploadFile = File(...),
    min_confidence: float = Query(0.0, ge=0, le=1, description="最低置信度过滤，低于此值不返回"),
    max_plates: int = Query(0, ge=0, description="最多返回数量，0 表示不限制"),
):
    try:
        contents = await file.read()
        if not contents:
            return {"error": "Empty file uploaded", "plates": []}

        nparr = np.frombuffer(contents, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if image is None:
            return {"error": "Failed to decode image. Please ensure the file is a valid image format.", "plates": []}

        results = catcher(image)
        plates = []
        for code, confidence, type_idx, box in results:
            if confidence < min_confidence:
                continue
            x1, y1, x2, y2 = box
            w = x2 - x1
            h = y2 - y1
            plate_type = _PLATE_TYPE_MAP.get(type_idx, "blue")
            if plate_type == "blue" and len(code) == 8:
                plate_type = "green"
            plates.append(
                {
                    "number": code,
                    "confidence": float(confidence),
                    "type": plate_type,
                    "rect": {"x": int(x1), "y": int(y1), "w": int(w), "h": int(h)},
                }
            )

        plates.sort(key=lambda p: (p["rect"]["y"], p["rect"]["x"]))
        if max_plates > 0:
            plates = plates[:max_plates]

        return {"plates": plates}

    except Exception as e:
        import traceback

        traceback.print_exc()
        return {"error": str(e), "plates": []}


def run():
    uvicorn.run(app, host="0.0.0.0", port=8001)


if __name__ == "__main__":
    run()

