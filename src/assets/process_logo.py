import sys
from PIL import Image

input_path = r"c:\Users\jiaho\Downloads\ChatGPT Image Jun 21, 2026, 02_48_27 PM.png"
output_path = r"c:\Users\jiaho\OneDrive - Tunku Abdul Rahman University College\Desktop\jiahong\Sonex\public\logo.png"

def main():
    try:
        img = Image.open(input_path).convert("RGBA")
        data = img.getdata()
        new_data = []
        for r, g, b, a in data:
            # Calculate distance from white
            if r > 245 and g > 245 and b > 245:
                # White background -> black
                new_data.append((0, 0, 0, 255))
            elif r > 200 and b > 200 and g > 200:
                # Near white (anti-aliasing) -> blend to black
                # subtract the white component
                # approximate blending:
                dark_r = max(0, r - 200) * 5
                dark_g = max(0, g - 200) * 5
                dark_b = max(0, b - 200) * 5
                new_data.append((min(r, dark_r), g, min(b, dark_b), a))
            else:
                new_data.append((r, g, b, a))
                
        img.putdata(new_data)
        img.save(output_path)
        print("Success! Logo saved to", output_path)
    except Exception as e:
        print("Error processing image:", e)
        sys.exit(1)

if __name__ == "__main__":
    main()
