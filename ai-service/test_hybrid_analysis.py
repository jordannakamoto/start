#!/usr/bin/env python3

import asyncio
import sys
import os

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services import ingest_pdf, summarize_pdf_with_citations
from models import PDFIngestRequest

async def test_hybrid_analysis():
    """Test the hybrid deterministic + LLM analysis system"""
    
    print("🔍 Testing Hybrid Analysis System...")
    print("=" * 50)
    
    # Test with sample content that should trigger various patterns
    test_pages = {
        1: """Introduction to Machine Learning. Machine learning is a subset of artificial intelligence that enables systems to learn and improve from experience without being explicitly programmed. The key components of machine learning include data, algorithms, and computational power. Conclusion: Machine learning represents a significant advancement in computer science.""",
        2: """Types of Machine Learning. There are three main types of machine learning: supervised learning, unsupervised learning, and reinforcement learning. Each type has different applications and methodologies. Machine learning algorithms are designed to identify patterns in data."""
    }
    
    try:
        # Stage 1: Ingest PDF
        print("📄 Ingesting PDF content...")
        request = PDFIngestRequest(pages=test_pages)
        ingest_result = await ingest_pdf(request)
        print(f"✅ Ingest Status: {ingest_result['status']}")
        
        if ingest_result['status'] == 'completed':
            pdf_id = ingest_result['job_id']
            print(f"📋 PDF ID: {pdf_id}")
            
            # Stage 2: Generate hybrid summary
            print("\n🤖 Generating hybrid analysis summary...")
            summary_result = await summarize_pdf_with_citations(pdf_id)
            
            print("\n" + "=" * 50)
            print("📊 HYBRID ANALYSIS RESULT")
            print("=" * 50)
            print(summary_result['response'])
            print("\n" + "=" * 50)
            print(f"📎 Citations Found: {len(summary_result.get('citations', []))}")
            print(f"🔗 Has Citations: {summary_result.get('has_citations', False)}")
            
            if summary_result.get('citations'):
                print("📋 Citation List:")
                for i, citation in enumerate(summary_result['citations'][:5], 1):
                    print(f"  {i}. {citation}")
                    
        else:
            print(f"❌ Ingest failed: {ingest_result.get('error', 'Unknown error')}")
            
    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_hybrid_analysis())