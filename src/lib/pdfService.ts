// PDF OCR Service for Web
// Uses the vivektools OCR server to extract text from PDF files

interface PDFExtractionResult {
  text: string;
  success: boolean;
  error?: string;
}

export class PDFService {
  private static readonly API_URL = 'https://ocr.collegebuzz.in/api/ocr';

  /**
   * Extract text from a PDF file using the vivektools OCR API
   * @param file - Browser File object
   * @param maxLength - Maximum length of text to return (default: unlimited)
   * @returns Promise with extracted text or error
   */
  static async extractTextFromPDF(
    file: File,
    maxLength?: number
  ): Promise<PDFExtractionResult> {
    try {
      // Validate file type
      if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
        return {
          text: '',
          success: false,
          error: 'File is not a PDF document'
        };
      }

      // Create FormData for upload
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(this.API_URL, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        return {
          text: '',
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }

      // Handle response
      let text = '';
      try {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const json = await response.json();
          // Check for different possible response formats
          text = json?.text || json?.content || json?.result || JSON.stringify(json);
        } else {
          text = await response.text();
        }
      } catch {
        text = await response.text();
      }

      // Apply length limit if specified
      const finalText = maxLength ? String(text || '').slice(0, maxLength) : String(text || '');

      if (!finalText.trim()) {
        return {
          text: '',
          success: false,
          error: 'No text content found in PDF'
        };
      }

      return {
        text: finalText.trim(),
        success: true
      };
    } catch (error) {
      return {
        text: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Extract text with progress callback for UI updates
   */
  static async extractTextWithProgress(
    file: File,
    onProgress?: (message: string) => void,
    maxLength?: number
  ): Promise<PDFExtractionResult> {
    if (onProgress) {
      onProgress('Uploading PDF...');
    }

    const result = await this.extractTextFromPDF(file, maxLength);

    if (onProgress) {
      if (result.success) {
        onProgress('Text extracted successfully');
      } else {
        onProgress('Extraction failed');
      }
    }

    return result;
  }

  /**
   * Quick validation to check if a file looks like a PDF
   */
  static validatePDFFile(file: File): { valid: boolean; error?: string } {
    if (!file) {
      return { valid: false, error: 'No file provided' };
    }

    const mimeType = file.type || '';
    const fileName = file.name || '';

    // Check MIME type
    if (mimeType && !mimeType.includes('pdf')) {
      return { valid: false, error: 'File is not a PDF document' };
    }

    // Check file extension as fallback
    if (fileName && !fileName.toLowerCase().endsWith('.pdf')) {
      return { valid: false, error: 'File does not have .pdf extension' };
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return { valid: false, error: 'File size exceeds 10MB limit' };
    }

    return { valid: true };
  }
}

export type { PDFExtractionResult };
