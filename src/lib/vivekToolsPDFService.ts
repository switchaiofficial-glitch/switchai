// Document text extraction service using vivektools OCR API
// Supports PDF, DOCX, PPTX, XLSX, DOC, PPT, XLS, TXT, CSV, RTF, and images
// Adapted for Web from React Native implementation

import serverHealthMonitor, { ServerType } from './serverHealthMonitor';

interface DocumentExtractionResult {
    text: string;
    success: boolean;
    error?: string;
    fileType?: string;
    filePath?: string; // Path to the OCR'd markdown file on server (for Smart Search tool)
    serverDown?: boolean; // Indicates if extraction failed due to server being down
    ocrType?: 'mistral' | 'local'; // Which OCR was used
    usage?: {
        chatLocked: boolean;
        lockedReason?: string;
        remaining: {
            dailyPremiumOcr: number;
            chatPremiumOcr: number;
            chatToolCalls: number;
        };
    };
}

// Web version uses standard File object
export type DocumentFile = File;

interface ExtractionOptions {
    uid?: string;      // User ID for usage tracking
    chatId?: string;   // Chat ID for per-chat limits
    maxLength?: number;
}

export class VivekToolsDocumentService {
    // Use AI server's centralized OCR endpoint (same as app)
    private static readonly API_URL = 'https://ai.collegebuzz.in/api/ocr';
    // Fallback to direct OCR for when AI server can't be reached
    private static readonly OCR_FALLBACK_URL = 'https://ocr.collegebuzz.in/api/ocr';

    /**
     * Check if OCR server is available (zero latency - cached)
     */
    static isServerAvailable(): boolean {
        return serverHealthMonitor.isHealthy(ServerType.OCR_SERVER);
    }

    /**
     * Extract text from any supported document using the centralized AI server
     * Supports: PDF, DOCX, PPTX, XLSX, DOC, PPT, XLS, TXT, CSV, RTF, and images
     * @param file - Standard File object
     * @param options - Extraction options including uid, chatId, maxLength
     * @returns Promise with extracted text or error
     */
    static async extractTextFromDocument(
        file: DocumentFile,
        options: ExtractionOptions = {}
    ): Promise<DocumentExtractionResult> {
        const { uid, chatId, maxLength } = options;

        // Check server health first (zero latency - uses cached value)
        const isServerHealthy = this.isServerAvailable();

        if (!isServerHealthy) {
            console.warn('[OCR] Server is down, skipping OCR extraction');
            return {
                text: '',
                success: false,
                error: 'OCR server is currently unavailable. Please try again later.',
                serverDown: true,
            };
        }

        try {
            const formData = new FormData();
            formData.append('file', file);

            // Build headers with uid and chatId for usage tracking
            const headers: Record<string, string> = {
                'Accept': 'application/json'
            };

            if (uid) {
                headers['X-User-Id'] = uid;
            }
            if (chatId) {
                headers['X-Chat-Id'] = chatId;
            }

            // Always use AI server endpoint (returns filePath for Smart Search tool)
            // Fallback only used if AI server is completely unreachable
            const endpoint = this.API_URL;

            const response = await fetch(endpoint, {
                method: 'POST',
                body: formData,
                headers
            });

            // Handle chat locked response (403)
            if (response.status === 403) {
                const errorData = await response.json();
                return {
                    text: '',
                    success: false,
                    error: errorData.error?.message || 'This chat has reached its limits.',
                    serverDown: false,
                    usage: {
                        chatLocked: true,
                        lockedReason: errorData.error?.message,
                        remaining: errorData.remaining || { dailyPremiumOcr: 0, chatPremiumOcr: 0, chatToolCalls: 0 }
                    }
                };
            }

            if (!response.ok) {
                // Mark server as potentially down on 5xx errors
                const serverDown = response.status >= 500;
                return {
                    text: '',
                    success: false,
                    error: `HTTP ${response.status}: ${response.statusText}`,
                    serverDown,
                };
            }

            let text = '';
            let fileType = '';
            let filePath: string | undefined;
            let ocrType: 'mistral' | 'local' | undefined;
            let usage: DocumentExtractionResult['usage'];

            try {
                const contentType = response?.headers?.get('content-type') || '';
                if (contentType.includes('application/json')) {
                    const json = await response.json();
                    // Check for different possible response formats
                    text = json?.text || json?.content || json?.result || JSON.stringify(json);
                    fileType = json?.fileType || '';
                    filePath = json?.filePath; // Capture filePath for Smart Search tool
                    ocrType = json?.ocrType;
                    usage = json?.usage;
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
                    error: 'No text content found in document',
                    serverDown: false,
                };
            }

            return {
                text: finalText.trim(),
                success: true,
                fileType,
                filePath,
                ocrType,
                usage,
                serverDown: false,
            };

        } catch (error) {
            // Network errors likely indicate server is down
            const isNetworkError = error instanceof Error &&
                (error.message.includes('network') ||
                    error.message.includes('fetch') ||
                    error.message.includes('timeout'));

            return {
                text: '',
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred',
                serverDown: isNetworkError,
            };
        }
    }

    /**
     * Extract text with progress callback for UI updates
     */
    static async extractTextWithProgress(
        file: DocumentFile,
        onProgress?: (message: string) => void,
        options: ExtractionOptions = {}
    ): Promise<DocumentExtractionResult> {
        try {
            // Check server health first
            if (!this.isServerAvailable()) {
                onProgress?.('OCR server is currently unavailable');
                return {
                    text: '',
                    success: false,
                    error: 'OCR server is currently unavailable. Please try again later.',
                    serverDown: true,
                };
            }

            onProgress?.('Uploading document for text extraction...');

            const result = await this.extractTextFromDocument(file, options);

            if (result.success) {
                onProgress?.('Text extraction completed successfully');
            } else if (result.usage?.chatLocked) {
                onProgress?.('Chat has reached its limits');
            } else if (result.serverDown) {
                onProgress?.('OCR server is unavailable');
            } else {
                onProgress?.(`Extraction failed: ${result.error}`);
            }

            return result;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            onProgress?.(`Extraction failed: ${errorMsg}`);

            return {
                text: '',
                success: false,
                error: errorMsg,
                serverDown: false,
            };
        }
    }

    /**
     * Quick validation to check if a file is supported
     */
    static validateDocumentFile(file: DocumentFile): { valid: boolean; error?: string } {
        if (!file) {
            return { valid: false, error: 'No file provided' };
        }

        const supportedExtensions = ['.pdf', '.docx', '.pptx', '.xlsx', '.doc', '.ppt', '.xls', '.txt', '.csv', '.rtf'];
        const supportedMimeTypes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/msword',
            'application/vnd.ms-powerpoint',
            'application/vnd.ms-excel',
            'text/plain',
            'text/csv',
            'application/rtf',
        ];

        const mimeType = file.type || '';
        const fileName = (file.name || '').toLowerCase();

        // Check MIME type
        if (mimeType && !supportedMimeTypes.includes(mimeType)) {
            // Some browsers might not detect mime types correctly for rare files, fallback to extension
            if (fileName && !supportedExtensions.some(ext => fileName.endsWith(ext))) {
                return { valid: false, error: 'Unsupported file type. Supported: PDF, DOCX, PPTX, XLSX, DOC, PPT, XLS, TXT, CSV, RTF' };
            }
        }

        // Check file extension as fallback if mime type is empty or generic
        if (fileName && !supportedExtensions.some(ext => fileName.endsWith(ext))) {
            // Dual check: if mime failed and extension failed
            return { valid: false, error: 'Unsupported file extension. Supported: ' + supportedExtensions.join(', ') };
        }

        return { valid: true };
    }

    // Legacy method names for backward compatibility
    static async extractTextFromPDF(file: DocumentFile, options?: ExtractionOptions | number): Promise<DocumentExtractionResult> {
        const opts = typeof options === 'number' ? { maxLength: options } : options;
        return this.extractTextFromDocument(file, opts);
    }

    static validatePDFFile(file: DocumentFile): { valid: boolean; error?: string } {
        return this.validateDocumentFile(file);
    }
}

export type { DocumentExtractionResult, ExtractionOptions };
// Legacy type exports
export type PDFExtractionResult = DocumentExtractionResult;
export type PDFFile = DocumentFile;

// Export as VivekToolsPDFService for backward compatibility
export const VivekToolsPDFService = VivekToolsDocumentService;
