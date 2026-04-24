import argparse
from aspose.logic.shaper import HarfBuzzShaper
from aspose.logic.layout_calculator import LayoutCalculator
from aspose.logic.line_breaker import LineBreaker

def main():
    parser = argparse.ArgumentParser(description="Aspose Text Layout Replicator CLI")
    parser.add_argument("--text", type=str, required=True, help="Text string to shape and measure")
    parser.add_argument("--font", type=str, required=True, help="Path to TTF font file")
    parser.add_argument("--size", type=float, required=True, help="Font size in points")
    parser.add_argument("--width", type=float, required=False, help="Container width in points for line breaking / justification")
    parser.add_argument("--justify", action="store_true", help="Apply ParagraphAlignment.Justify mathematics")
    
    args = parser.parse_args()
    
    # 1. Initialize Shaper
    shaper = HarfBuzzShaper(args.font)
    upem = shaper.get_upem()
    print(f"[Shaper] Font UPEM: {upem}")
    
    # Needs to find space glyph id. For now we shape a single space.
    space_glyphs = shaper.shape_text(" ")
    space_glyph_id = space_glyphs[0]['glyph_id'] if space_glyphs else 3
    print(f"[Shaper] Space Glyph ID: {space_glyph_id}")
    
    # 2. Shape the text
    shaped = shaper.shape_text(args.text)
    print(f"[Shaper] Extracted {len(shaped)} glyph advances.")
    
    # 3. Initialize Layout Calculator
    lc = LayoutCalculator(args.size, upem)
    
    # Calculate Total Width (Unbroken)
    total_twips = lc.calculate_run_width_twips(shaped)
    print(f"[Layout] Total Unbroken Line Width: {total_twips} twips ({total_twips / 20.0} pts)")
    
    if args.width is not None:
        container_twips = lc.points_to_twips(args.width)
        print(f"[Layout] Container Width: {container_twips} twips")
        
        # 4. Line Breaking
        breaker = LineBreaker(lc, space_glyph_id)
        lines = breaker.break_lines(shaped, container_twips)
        print(f"[Break] Broke text into {len(lines)} lines")
        
        for i, line in enumerate(lines):
            line_twips = lc.calculate_run_width_twips(line)
            print(f"  Line {i+1}: {len(line)} glyphs, {line_twips} twips")
            
            # 5. Justification 
            if args.justify:
                justify_info = lc.calculate_justified_spaces(line, container_twips, space_glyph_id)
                if justify_info.get("space_count", 0) > 0:
                    extra = justify_info['extra_space_per_gap_twips']
                    rem = justify_info['remainder']
                    print(f"    [Justify] Expanding {justify_info['space_count']} spaces by {extra} twips (remainder {rem})")

if __name__ == "__main__":
    main()

