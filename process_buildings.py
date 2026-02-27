import os
from PIL import Image

def process_image(filepath):
    try:
        img = Image.open(filepath).convert("RGBA")
        data = img.load()
        width, height = img.size
        
        # Determine background color from corners
        # Sample multiple pixels to detect checkerboard
        samples = [
            data[0, 0], data[10, 0], data[0, 10], data[10, 10],
            data[width-1, 0], data[width-11, 0],
            data[0, height-1], data[10, height-1],
            data[width-1, height-1], data[width-11, height-1]
        ]
        
        # Find unique colors in the sample
        bg_colors = []
        for s in samples:
            if s[3] < 255: continue # already transparent
            found = False
            for b in bg_colors:
                if abs(s[0]-b[0]) < 10 and abs(s[1]-b[1]) < 10 and abs(s[2]-b[2]) < 10:
                    found = True
                    break
            if not found:
                bg_colors.append(s)
                
        tolerance_solid = 25
        tolerance_checker = 35 # larger tolerance for checkerboard noise
        
        def is_bg(r, g, b, a):
            if a < 255: return True
            for bg in bg_colors:
                tolerance = tolerance_checker if len(bg_colors) > 1 else tolerance_solid
                if abs(r - bg[0]) < tolerance and abs(g - bg[1]) < tolerance and abs(b - bg[2]) < tolerance:
                    return True
            return False
            
        # First pass: find background
        for y in range(height):
            for x in range(width):
                r, g, b, a = data[x, y]
                if is_bg(r, g, b, a):
                    data[x, y] = (0, 0, 0, 0)
                    
        # Find Bounding Box
        min_x = width
        min_y = height
        max_x = 0
        max_y = 0
        for y in range(height):
            for x in range(width):
                if data[x, y][3] > 0:
                    if x < min_x: min_x = x
                    if x > max_x: max_x = x
                    if y < min_y: min_y = y
                    if y > max_y: max_y = y
                    
        if min_x > max_x:
            print(f"Skipping {filepath} - all transparent")
            return
            
        # Crop
        img = img.crop((min_x, min_y, max_x + 1, max_y + 1))
        
        # Resize to fit building grid. A typical building could be max 256px wide (for beautiful details)
        target_width = 160
        aspect_ratio = img.height / img.width
        target_height = int(target_width * aspect_ratio)
        img = img.resize((target_width, target_height), Image.Resampling.LANCZOS)
        
        # Ensure we save to public/assets/buildings directly to overwrite original
        img.save(filepath)
        print(f"Processed {filepath} with {len(bg_colors)} background colors detected")
    except Exception as e:
        print(f"Error processing {filepath}: {e}")

directory = 'public/assets/buildings/'
if not os.path.exists(directory):
    print("Directory not found")
    exit(1)
    
for filename in os.listdir(directory):
    if filename.endswith(".png"):
        process_image(os.path.join(directory, filename))
