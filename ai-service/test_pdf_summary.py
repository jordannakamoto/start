import asyncio
from pocketflow import AsyncNode, AsyncFlow, Node, Flow
from typing import Dict, List, Tuple
import re

class PDFParseNode(Node):
    def prep(self, shared):
        pdf_pages = shared.get('pdf_pages', {})
        return pdf_pages
    
    def exec(self, pdf_pages):
        parsed_content = []
        for page_num, content in pdf_pages.items():
            # Improved paragraph splitting that handles various formats
            content = content.strip()
            
            # First try splitting on double newlines
            paragraphs = content.split('\n\n')
            
            # If that doesn't work well (very few paragraphs), try single newlines
            if len(paragraphs) <= 1:
                paragraphs = content.split('\n')
            
            # Clean and filter paragraphs
            clean_paragraphs = []
            for p in paragraphs:
                p = p.strip()
                # Skip very short paragraphs (likely artifacts)
                if len(p) > 20:
                    clean_paragraphs.append(p)
            
            # If still no good paragraphs, treat whole content as one paragraph
            if not clean_paragraphs:
                clean_paragraphs = [content]
            
            parsed_content.append({
                'page': page_num,
                'content': content,
                'paragraphs': clean_paragraphs
            })
        return parsed_content
    
    def post(self, shared, prep_res, exec_res):
        shared['parsed_pages'] = exec_res
        return None

class CitationExtractionNode(Node):
    def prep(self, shared):
        return shared.get('parsed_pages', [])
    
    def exec(self, parsed_pages):
        citations = []
        for page_data in parsed_pages:
            page_num = page_data['page']
            for para_idx, paragraph in enumerate(page_data['paragraphs']):
                # Improved sentence splitting that handles more cases
                # Split on sentence endings but avoid splitting on abbreviations
                sentences = re.split(r'(?<=[.!?])\s+(?=[A-Z])', paragraph)
                
                # Further split long sentences that might have missed splits
                final_sentences = []
                for sentence in sentences:
                    if len(sentence) > 300:  # Split very long sentences
                        # Try to split on semicolons or conjunctions
                        sub_sentences = re.split(r'(?<=;)\s+|(?<=,)\s+(?=(?:and|but|or|however|therefore|thus|moreover|furthermore)\s)', sentence)
                        final_sentences.extend(sub_sentences)
                    else:
                        final_sentences.append(sentence)
                
                for sent_idx, sentence in enumerate(final_sentences):
                    sentence = sentence.strip()
                    if sentence and len(sentence) > 10:  # Only include substantial sentences
                        citation = {
                            'page': page_num,
                            'paragraph': para_idx + 1,
                            'sentence': sent_idx + 1,
                            'text': sentence,
                            'ref': f"p{page_num}.para{para_idx + 1}.s{sent_idx + 1}"
                        }
                        citations.append(citation)
        return citations
    
    def post(self, shared, prep_res, exec_res):
        shared['citations'] = exec_res
        return None

class KeyPointsExtractionNode(Node):
    def prep(self, shared):
        return shared.get('citations', [])
    
    def exec(self, citations):
        key_points = []
        min_sentence_length = 50
        
        for citation in citations:
            if len(citation['text']) >= min_sentence_length:
                sentences_lower = citation['text'].lower()
                if any(keyword in sentences_lower for keyword in ['important', 'key', 'significant', 'conclusion', 'result', 'finding']):
                    key_points.append({
                        'text': citation['text'],
                        'ref': citation['ref'],
                        'page': citation['page']
                    })
        
        return key_points[:10]
    
    def post(self, shared, prep_res, exec_res):
        shared['key_points'] = exec_res
        return None

class SummaryGenerationNode(Node):
    def prep(self, shared):
        return {
            'parsed_pages': shared.get('parsed_pages', []),
            'key_points': shared.get('key_points', []),
            'citations': shared.get('citations', [])
        }
    
    def exec(self, data):
        summary_parts = ["# PDF Summary\n"]
        
        summary_parts.append("## Overview")
        total_pages = len(data['parsed_pages'])
        total_paragraphs = sum(len(p['paragraphs']) for p in data['parsed_pages'])
        summary_parts.append(f"Document contains {total_pages} pages with {total_paragraphs} paragraphs.\n")
        
        summary_parts.append("## Key Points")
        if data['key_points']:
            for idx, point in enumerate(data['key_points'], 1):
                summary_parts.append(f"{idx}. {point['text']} [{point['ref']}]")
        else:
            summary_parts.append("No key points identified.\n")
        
        summary_parts.append("\n## Page-by-Page Summary")
        for page_data in data['parsed_pages'][:3]:
            page_num = page_data['page']
            summary_parts.append(f"\n### Page {page_num}")
            
            for para_idx, para in enumerate(page_data['paragraphs'][:2], 1):
                if len(para) > 100:
                    excerpt = para[:100] + "..."
                else:
                    excerpt = para
                summary_parts.append(f"- Paragraph {para_idx}: {excerpt} [p{page_num}.para{para_idx}]")
        
        summary_parts.append("\n## Citations Index")
        summary_parts.append(f"Total citations available: {len(data['citations'])}")
        
        return '\n'.join(summary_parts)
    
    def post(self, shared, prep_res, exec_res):
        shared['summary'] = exec_res
        return exec_res

def create_pdf_summary_flow():
    flow = Flow()
    
    parse_node = PDFParseNode()
    citation_node = CitationExtractionNode()
    keypoints_node = KeyPointsExtractionNode()
    summary_node = SummaryGenerationNode()
    
    flow.start(parse_node)
    parse_node >> citation_node >> keypoints_node >> summary_node
    
    return flow

def test_pdf_summary():
    sample_pdf_data = {
        1: """Introduction to Machine Learning

Machine learning is a subset of artificial intelligence that enables systems to learn and improve from experience without being explicitly programmed. This is an important concept in modern computing.

The key components of machine learning include data, algorithms, and computational power. These elements work together to create intelligent systems.

Conclusion: Machine learning represents a significant advancement in computer science.""",
        
        2: """Types of Machine Learning

There are three main types of machine learning: supervised learning, unsupervised learning, and reinforcement learning. Each type has its own unique characteristics and applications.

Supervised learning uses labeled data to train models. This is the most common type of machine learning used in practice today.

Unsupervised learning finds patterns in unlabeled data. This approach is particularly useful for discovering hidden structures in data."""
    }
    
    shared_context = {'pdf_pages': sample_pdf_data}
    
    flow = create_pdf_summary_flow()
    result = flow.run(shared_context)
    
    print("Generated Summary:")
    print("-" * 50)
    print(result)
    print("-" * 50)
    print("\nShared Context Keys:", list(shared_context.keys()))
    print(f"Total Citations: {len(shared_context.get('citations', []))}")
    print(f"Key Points Found: {len(shared_context.get('key_points', []))}")

if __name__ == "__main__":
    test_pdf_summary()