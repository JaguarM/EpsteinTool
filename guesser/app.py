import os
from flask import Flask, request, jsonify, send_from_directory, Response
from logic.ProcessRedactions import process_pdf, process_image
from logic.width_calculator import get_text_widths, get_available_fonts
from logic.artifact_visualizer import generate_mask_for_page

app = Flask(__name__, static_folder='.', static_url_path='')

_store = {'pdf_bytes': None}

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

IMAGE_MIME_TYPES = {'image/png', 'image/jpeg', 'image/jpg', 'image/tiff', 'image/bmp', 'image/webp'}
IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.tif', '.tiff', '.bmp', '.webp'}

@app.route('/analyze-pdf', methods=['POST'])
def analyze_pdf():
    if 'file' not in request.files:
        return jsonify({"detail": "No file uploaded"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"detail": "No file selected"}), 400

    try:
        file_bytes = file.read()
        mime = (file.content_type or '').lower()
        ext = os.path.splitext(file.filename or '')[1].lower()
        is_image = mime in IMAGE_MIME_TYPES or ext in IMAGE_EXTENSIONS

        _store['pdf_bytes'] = None if is_image else file_bytes
        result = process_image(file_bytes, mime or 'image/png') if is_image else process_pdf(file_bytes)

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
    kerning = data.get('kerning', True)
    ligatures = data.get('ligatures', True)
    
    try:
        # Convert scale percentage to multiplier (135 -> 1.35)
        scale_factor = scale / 100.0
        widths = get_text_widths(texts, font_name, font_size, force_uppercase, scale_factor, kerning, ligatures)
        return jsonify({"results": widths})
    except Exception as e:
        return jsonify({"detail": str(e)}), 500

@app.route('/mask/<int:page_num>', methods=['GET'])
def get_mask(page_num):
    if not _store['pdf_bytes']:
        return jsonify({"detail": "No PDF uploaded"}), 400
    mask_png = generate_mask_for_page(_store['pdf_bytes'], page_num)
    if not mask_png:
        return jsonify({"detail": "No mask available"}), 404
    return Response(mask_png, mimetype='image/png')

@app.route('/fonts-list', methods=['GET'])
def list_fonts():
    return jsonify(get_available_fonts())

if __name__ == '__main__':
    app.run(debug=True, port=5000)
