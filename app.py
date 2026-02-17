from flask import Flask, request, jsonify, send_from_directory
import os
from logic.image_processor import process_pdf
from logic.width_calculator import get_text_widths, get_available_fonts

app = Flask(__name__, static_folder='.', static_url_path='')

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/analyze-pdf', methods=['POST'])
def analyze_pdf():
    if 'file' not in request.files:
        return jsonify({"detail": "No file uploaded"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"detail": "No file selected"}), 400
    
    try:
        pdf_bytes = file.read()
        result = process_pdf(pdf_bytes)
        if "error" in result:
             return jsonify({"detail": result["error"]}), 500
        return jsonify(result)
    except Exception as e:
        return jsonify({"detail": str(e)}), 500

@app.route('/widths', methods=['POST'])
def calculate_widths():
    data = request.json
    texts = data.get('strings', [])
    font_name = data.get('font', 'times.ttf')
    font_size = data.get('size', 12)
    force_uppercase = data.get('force_uppercase', False)
    scale = data.get('scale', 135)
    
    # Optional flags like kerning/ligatures are tricky with PIL directly
    # PIL handles basic shaping usually.
    # We will pass what we can.
    
    try:
        # Convert scale percentage to multiplier (135 -> 1.35)
        scale_factor = scale / 100.0
        widths = get_text_widths(texts, font_name, font_size, force_uppercase, scale_factor)
        return jsonify({"results": widths})
    except Exception as e:
        return jsonify({"detail": str(e)}), 500

@app.route('/fonts-list', methods=['GET'])
def list_fonts():
    return jsonify(get_available_fonts())

if __name__ == '__main__':
    app.run(debug=True, port=5000)
