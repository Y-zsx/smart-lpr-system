from fastapi import FastAPI, File, UploadFile
import uvicorn
import hyperlpr3 as lpr3
import cv2
import numpy as np
import io

app = FastAPI()

# Initialize HyperLPR3
catcher = lpr3.LicensePlateCatcher()

@app.post("/recognize")
async def recognize(file: UploadFile = File(...)):
    try:
        # Read image file
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        # Run recognition
        # catch returns list of [code, confidence, type_idx, box]
        results = catcher(image)
        
        plates = []
        for code, confidence, type_idx, box in results:
            # box is [x1, y1, x2, y2]
            x1, y1, x2, y2 = box
            w = x2 - x1
            h = y2 - y1
            
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

        return {"plates": plates}

    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
