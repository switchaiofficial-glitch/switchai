import { getCerebrasKey } from './cerebrasClient';
import { VivekToolsDocumentService } from './vivekToolsPDFService';

// Web version uses standard File
export type DocumentInput = File;

interface ExtractedDocumentContent {
    text: string;
    metadata: {
        title?: string;
        author?: string;
        pages: number;
        fileSize: number;
        fileType?: string;
    };
}

interface DocumentAnalysisOptions {
    analysisType: 'comprehensive' | 'summary' | 'key-points' | 'detailed-explanation';
    sections?: string[];
    customPrompt?: string;
}

interface DocumentAnalysisResult {
    analysis: string;
    sections: {
        title: string;
        content: string;
        summary: string;
    }[];
    keyInsights: string[];
    metadata: {
        tokenCount: number;
        processingTime: number;
        model: string;
        fileType?: string;
    };
}

// Text chunking for Cerebras token limits
class TextChunker {
    private static readonly MAX_TOKENS = 45000; // Keep under 50k limit with buffer
    private static readonly OVERLAP_TOKENS = 500;

    static chunkText(text: string, maxTokens: number = this.MAX_TOKENS): string[] {
        // Simple token estimation (rough: 1 token ≈ 4 characters)
        const estimateTokens = (text: string) => Math.ceil(text.length / 4);

        if (estimateTokens(text) <= maxTokens) {
            return [text];
        }

        const chunks: string[] = [];
        const sentences = text.split(/[.!?]+/).filter(s => s.trim());

        let currentChunk = '';
        let currentTokens = 0;

        for (const sentence of sentences) {
            const sentenceTokens = estimateTokens(sentence);

            if (currentTokens + sentenceTokens > maxTokens && currentChunk) {
                chunks.push(currentChunk.trim());

                // Add overlap from previous chunk
                const overlapText = currentChunk.slice(-this.OVERLAP_TOKENS * 4);
                currentChunk = overlapText + sentence;
                currentTokens = estimateTokens(currentChunk);
            } else {
                currentChunk += sentence + '.';
                currentTokens += sentenceTokens;
            }
        }

        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }

        return chunks;
    }
}

// Main Document Analyzer Service
// Supports: PDF, DOCX, PPTX, XLSX, DOC, PPT, XLS, TXT, CSV, RTF
export class DocumentAnalyzerService {

    static async analyzeDocument(
        file: DocumentInput,
        options: DocumentAnalysisOptions,
        onProgress?: (progress: number, message: string) => void
    ): Promise<DocumentAnalysisResult> {
        const startTime = Date.now();

        try {
            // Step 1: Extract text from document
            const fileType = this.getFileTypeFromMime(file.type) || 'document';
            onProgress?.(10, `Extracting text from ${fileType.toUpperCase()}...`);

            // Use the VivekTools service with progress updates
            const extractionResult = await VivekToolsDocumentService.extractTextWithProgress(
                file,
                (message) => onProgress?.(15, message)
            );

            if (!extractionResult.success) {
                throw new Error(extractionResult.error || 'Text extraction failed');
            }

            const extractedContent: ExtractedDocumentContent = {
                text: extractionResult.text,
                metadata: {
                    title: undefined,
                    author: undefined,
                    pages: 0,
                    fileSize: file.size,
                    fileType: extractionResult.fileType || fileType,
                },
            };

            if (!extractedContent.text.trim()) {
                throw new Error('No text content found in document');
            }

            // Step 2: Chunk text for processing
            onProgress?.(30, 'Preparing content for analysis...');
            const chunks = TextChunker.chunkText(extractedContent.text);

            // Step 3: Analyze each chunk with Cerebras
            onProgress?.(50, 'Analyzing content with AI...');
            const analysisResults = await this.analyzeChunks(chunks, options, onProgress);

            // Step 4: Combine and structure results
            onProgress?.(90, 'Finalizing analysis...');
            const finalResult = await this.combineAnalysisResults(
                analysisResults,
                extractedContent,
                options
            );

            onProgress?.(100, 'Analysis complete!');

            const result: DocumentAnalysisResult = {
                analysis: finalResult.analysis,
                sections: finalResult.sections,
                keyInsights: finalResult.keyInsights,
                metadata: {
                    tokenCount: Math.min(6000 * analysisResults.length, Math.ceil(finalResult.analysis.length / 4)),
                    processingTime: Date.now() - startTime,
                    model: 'qwen-3-235b-a22b-instruct-2507',
                    fileType: extractedContent.metadata.fileType,
                },
            };

            return result;
        } catch (error) {
            throw new Error(`Document analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private static getFileTypeFromMime(mimeType: string): string {
        const mimeMap: Record<string, string> = {
            'application/pdf': 'PDF',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
            'application/msword': 'DOC',
            'application/vnd.ms-powerpoint': 'PPT',
            'application/vnd.ms-excel': 'XLS',
            'text/plain': 'TXT',
            'text/csv': 'CSV',
            'application/rtf': 'RTF',
        };
        return mimeMap[mimeType] || 'Document';
    }

    private static async analyzeChunks(
        chunks: string[],
        options: DocumentAnalysisOptions,
        onProgress?: (progress: number, message: string) => void
    ): Promise<string[]> {
        const apiKey = await getCerebrasKey();
        const results: string[] = [];

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const chunkProgress = 50 + (i / chunks.length) * 30;
            onProgress?.(chunkProgress, `Analyzing section ${i + 1} of ${chunks.length}...`);

            const prompt = this.buildAnalysisPrompt(chunk, options, i + 1, chunks.length);

            // Using proxy endpoint consistent with App implementation
            const response = await fetch('https://ai.collegebuzz.in/cerebras/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'qwen-3-235b-a22b-instruct-2507',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are an expert document analyzer. Provide CONCISE, well-structured analysis. Focus on key concepts and essential details only. Keep responses under 6000 tokens total. FORMATTING RULES: Use ONLY basic markdown - headers (#, ##, ###), **bold**, *italic*, bullet points (-), and plain paragraphs. NEVER use tables, code blocks, math formulas, LaTeX, or complex formatting.',
                        },
                        {
                            role: 'user',
                            content: prompt,
                        },
                    ],
                    max_tokens: 6000,
                    temperature: 0.2,
                    top_p: 0.8,
                    apiKey,
                }),
            });

            if (!response.ok) {
                throw new Error(`Analysis request failed: ${response.statusText}`);
            }

            const data = await response.json();
            results.push(data.choices[0].message.content);
        }

        return results;
    }

    private static buildAnalysisPrompt(
        chunk: string,
        options: DocumentAnalysisOptions,
        chunkIndex: number,
        totalChunks: number
    ): string {
        const basePrompt = `
Analyze this document section (Part ${chunkIndex} of ${totalChunks}) concisely. Keep your response under 4000 tokens.

Document Content:
"""
${chunk}
"""

Structure your response EXACTLY as follows:

# Key Concepts
- List the 3-5 main topics/themes (1-2 sentences each)
- Focus on the most important ideas only
- Use **bold** for key terms and *italic* for emphasis

## Section Details
- Break down key points into digestible pieces
- Use bullet points and brief explanations
- Include any important processes, methods, or frameworks
- Keep each point to 1-2 sentences maximum
- Use **bold** for important concepts and *italic* for clarification

## Summary
- Provide a concise 2-3 sentence overview
- Highlight the most critical takeaways
- Focus on practical implications

FORMATTING RESTRICTIONS:
- ONLY use: headers (#, ##, ###), **bold**, *italic*, bullet points (-), paragraphs
- NEVER use: tables, code blocks, math formulas, LaTeX, complex formatting
- Keep everything CONCISE and ACTIONABLE.
`;

        return basePrompt;
    }

    private static async combineAnalysisResults(
        analysisResults: string[],
        extractedContent: ExtractedDocumentContent,
        options: DocumentAnalysisOptions
    ): Promise<{ analysis: string; sections: Array<{ title: string; content: string; summary: string }>; keyInsights: string[] }> {
        // Combine all analysis results
        const combinedAnalysis = analysisResults.join('\n\n---\n\n');

        // Parse the structured content
        const parsedContent = this.parseStructuredAnalysis(combinedAnalysis);

        // Extract sections from the analysis
        const sections = this.extractSections(combinedAnalysis);

        // Use parsed key concepts as insights
        const keyInsights = parsedContent.keyConcepts.length > 0
            ? parsedContent.keyConcepts
            : this.extractKeyInsights(combinedAnalysis);

        // Create a cleaner formatted analysis
        const formattedAnalysis = this.formatAnalysisOutput(parsedContent);

        return {
            analysis: formattedAnalysis,
            sections,
            keyInsights,
        };
    }

    private static extractSections(analysis: string): Array<{ title: string; content: string; summary: string }> {
        const sections: Array<{ title: string; content: string; summary: string }> = [];

        const lines = analysis.split('\n');
        let currentSection: { title: string; content: string; summary: string } | null = null;

        for (const line of lines) {
            const trimmedLine = line.trim();

            // Check if line is a header
            if (
                trimmedLine.match(/^#{1,6}\s+/) ||
                trimmedLine.match(/^\d+\.\s+/) ||
                (trimmedLine.length > 10 && trimmedLine === trimmedLine.toUpperCase() && trimmedLine.includes(' '))
            ) {
                // Save previous section
                if (currentSection && currentSection.content.trim()) {
                    sections.push({
                        ...currentSection,
                        summary: this.generateSectionSummary(currentSection.content),
                    });
                }

                // Start new section
                currentSection = {
                    title: trimmedLine.replace(/^#{1,6}\s+/, '').replace(/^\d+\.\s+/, ''),
                    content: '',
                    summary: '',
                };
            } else if (currentSection && trimmedLine) {
                currentSection.content += line + '\n';
            }
        }

        if (currentSection && currentSection.content.trim()) {
            sections.push({
                ...currentSection,
                summary: this.generateSectionSummary(currentSection.content),
            });
        }

        return sections;
    }

    private static generateSectionSummary(content: string): string {
        const sentences = content.split(/[.!?]+/).filter(s => s.trim());
        const firstTwoSentences = sentences.slice(0, 2).join('. ');
        return firstTwoSentences.length > 150
            ? firstTwoSentences.substring(0, 150) + '...'
            : firstTwoSentences;
    }

    private static parseStructuredAnalysis(analysis: string): {
        keyConcepts: string[];
        sectionDetails: string[];
        summary: string;
    } {
        const result = {
            keyConcepts: [] as string[],
            sectionDetails: [] as string[],
            summary: ''
        };

        const lines = analysis.split('\n');
        let currentSection = '';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (line.match(/^#\s*(KEY\s*)?CONCEPTS?/i)) {
                currentSection = 'concepts';
                continue;
            } else if (line.match(/^##?\s*SECTION\s*DETAILS?/i)) {
                currentSection = 'details';
                continue;
            } else if (line.match(/^##?\s*SUMMARY/i)) {
                currentSection = 'summary';
                continue;
            }

            if (line && currentSection) {
                if (currentSection === 'concepts' && line.match(/^[\-•\*]\s+/)) {
                    const concept = line.replace(/^[\-•\*]\s+/, '').trim();
                    if (concept && concept.length > 10) {
                        result.keyConcepts.push(concept);
                    }
                } else if (currentSection === 'details' && line.match(/^[\-•\*]\s+/)) {
                    const detail = line.replace(/^[\-•\*]\s+/, '').trim();
                    if (detail && detail.length > 10) {
                        result.sectionDetails.push(detail);
                    }
                } else if (currentSection === 'summary' && line && !line.startsWith('#')) {
                    result.summary += (result.summary ? ' ' : '') + line;
                }
            }
        }

        return result;
    }

    private static formatAnalysisOutput(parsedContent: {
        keyConcepts: string[];
        sectionDetails: string[];
        summary: string;
    }): string {
        let formatted = '';

        if (parsedContent.keyConcepts.length > 0) {
            formatted += '# Key Concepts\n\n';
            parsedContent.keyConcepts.forEach(concept => {
                formatted += `- ${concept}\n`;
            });
            formatted += '\n';
        }

        if (parsedContent.sectionDetails.length > 0) {
            formatted += '## Section Details\n\n';
            parsedContent.sectionDetails.forEach(detail => {
                formatted += `- ${detail}\n`;
            });
            formatted += '\n';
        }

        if (parsedContent.summary) {
            formatted += '## Summary\n\n';
            formatted += parsedContent.summary + '\n';
        }

        return formatted;
    }

    private static extractKeyInsights(analysis: string): string[] {
        const insights: string[] = [];
        const lines = analysis.split('\n');

        for (const line of lines) {
            const trimmedLine = line.trim();

            if (
                trimmedLine.includes('key insight') ||
                trimmedLine.includes('important') ||
                trimmedLine.includes('significant') ||
                trimmedLine.includes('critical') ||
                trimmedLine.match(/^[•\-\*]\s+/) ||
                trimmedLine.match(/^\d+\.\s+.*(?:important|key|significant|critical)/)
            ) {
                const cleanInsight = trimmedLine
                    .replace(/^[•\-\*]\s+/, '')
                    .replace(/^\d+\.\s+/, '')
                    .trim();

                if (cleanInsight.length > 20 && !insights.includes(cleanInsight)) {
                    insights.push(cleanInsight);
                }
            }
        }

        return insights.slice(0, 10);
    }
}

export type { DocumentAnalysisOptions, DocumentAnalysisResult };
export const PDFAnalyzerService = DocumentAnalyzerService;
