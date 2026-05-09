import cv2
import numpy as np

# Create a 20x20 mask
mask = np.zeros((30, 30), dtype=np.uint8)
# Add a 10x15 redaction block
mask[5:15, 5:20] = 255
# Add a 4x4 protrusion (text)
mask[15:19, 10:14] = 255

kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
opened = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)

print("Original mask:")
for row in (mask > 0).astype(int):
    print("".join(map(str, row)))
print("Opened mask:")
for row in (opened > 0).astype(int):
    print("".join(map(str, row)))
