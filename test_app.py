import os
import unittest
import fitz
import json
from app import app
from io import BytesIO

class TestRedactionGuesser(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True

    def test_fonts_list(self):
        response = self.app.get('/fonts-list')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIsInstance(data, list)
        self.assertIn('times.ttf', data)

    def test_calculate_widths(self):
        payload = {
            "strings": ["Hello", "World"],
            "font": "times.ttf",
            "size": 12
        }
        response = self.app.post('/widths', json=payload)
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('results', data)
        self.assertEqual(len(data['results']), 2)
        self.assertTrue(data['results'][0]['width'] > 0)

    def test_analyze_pdf(self):
        # Create a dummy PDF with a black bar using PyMuPDF
        doc = fitz.open()
        page = doc.new_page()
        
        # Draw a black rectangle (redaction bar)
        # Rect(x0, y0, x1, y1)
        rect = fitz.Rect(100, 100, 200, 120) 
        shape = page.new_shape()
        shape.draw_rect(rect)
        shape.finish(color=(0, 0, 0), fill=(0, 0, 0))
        shape.commit()
        
        # Add some text
        page.insert_text((50, 50), "Confidential Document", fontsize=12)
        
        pdf_bytes = doc.tobytes()
        doc.close()
        
        # Send to endpoint
        data = {
            'file': (BytesIO(pdf_bytes), 'test.pdf')
        }
        response = self.app.post('/analyze-pdf', data=data, content_type='multipart/form-data')
        
        self.assertEqual(response.status_code, 200)
        resp_data = json.loads(response.data)
        
        self.assertIn('redactions', resp_data)
        self.assertIn('spans', resp_data)
        
        # Check if we found the redaction
        # PDF point to Pixel (96 DPI): val * (96/72) = val * 1.333
        expected_width = 100 * (96/72)
        expected_height = 20 * (96/72)
        
        found = False
        print(f"DEBUG: Found redactions: {resp_data['redactions']}")
        for r in resp_data['redactions']:
            if abs(r['width'] - expected_width) < 10 and abs(r['height'] - expected_height) < 10:
                found = True
                break
        
        self.assertTrue(found, f"Did not detect the black bar correctly. Expected W~{expected_width}, H~{expected_height}")

if __name__ == '__main__':
    unittest.main()
