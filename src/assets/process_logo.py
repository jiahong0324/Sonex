import sys
import os

try:
    from rembg import remove
    from PIL import Image
except ImportError:
    print("rembg or PIL not installed yet.")
    sys.exit(1)

input_path = r"c:\Users\jiaho\Downloads\ChatGPT Image Jun 21, 2026, 02_48_27 PM.png"
output_path = r"c:\Users\jiaho\OneDrive - Tunku Abdul Rahman University College\Desktop\jiahong\Sonex\public\logo.png"

def main():
    try:
        # Load the input image
        img = Image.open(input_path).convert("RGBA")
        
        # Remove background (gives transparent background)
        output_img = remove(img)
        
        # Create a solid black background
        black_bg = Image.new("RGBA", output_img.size, (0, 0, 0, 255))
        
        # Composite the foreground over the black background
        final_img = Image.alpha_composite(black_bg, output_img)
        
        # Save as PNG
        final_img.convert("RGB").save(output_path)
        print("Success! Logo saved to", output_path)
    except Exception as e:
        print("Error processing image:", e)
        sys.exit(1)

if __name__ == "__main__":
    main()
