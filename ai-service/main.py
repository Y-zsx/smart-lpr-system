from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import hyperlpr3 as lpr3
import cv2
import numpy as np
import io

app = FastAPI()

# 添加 CORS 中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],  # 前端地址
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize HyperLPR3
catcher = lpr3.LicensePlateCatcher()

@app.get("/health")
async def health():
    """健康检查端点"""
    return {"status": "online", "service": "AI Recognition Service"}

@app.post("/recognize")
async def recognize(file: UploadFile = File(...)):
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

        # Run recognition
        # catch returns list of [code, confidence, type_idx, box]
        results = catcher(image)
        
        print(f"Recognition results count: {len(results)}")
        
        plates = []
        for code, confidence, type_idx, box in results:
            # box is [x1, y1, x2, y2]
            x1, y1, x2, y2 = box
            w = x2 - x1
            h = y2 - y1
            
            print(f"Detected plate: {code}, confidence: {confidence}, type_idx: {type_idx}")
            
            # Determine plate type (simplified mapping based on HyperLPR3 docs/behavior)
            # 0: Blue, 1: Yellow, 2: Green, etc. (This might need adjustment based on specific version)
            plate_type = "blue"
            if type_idx == 3 or len(code) == 8: # Green plates usually 8 chars
                plate_type = "green"
            elif type_idx == 1:
                plate_type = "yellow"

            plates.append({
                "number": code,
                "confidence": float(confidence),
                "type": plate_type,
                "rect": {
                    "x": int(x1),
                    "y": int(y1),
                    "w": int(w),
                    "h": int(h)
                }
            })

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
