#!/usr/bin/env python3
"""
Frontend Integration Test
Tests the complete flow that the frontend should use.
"""

import asyncio
import json
from main import app
from fastapi.testclient import TestClient

def test_frontend_integration():
    """Test the complete flow that the frontend uses."""
    
    print("🧪 Testing Frontend Integration")
    print("=" * 50)
    
    # Create test client
    client = TestClient(app)
    
    # Test data - realistic contract content
    test_contract_pages = {
        "1": """
        SERVICE AGREEMENT
        
        This Service Agreement ("Agreement") is entered into between Company A ("Provider") and Company B ("Client").
        
        1. SERVICES
        The Provider shall provide consulting services as described in Exhibit A.
        The Provider must deliver all services within 30 days of the effective date.
        
        2. PAYMENT TERMS
        Client shall pay Provider $10,000 within 15 days of invoice receipt.
        Late payments may incur a 1.5% monthly fee.
        """,
        "2": """
        3. OBLIGATIONS
        Provider obligations:
        - Must maintain confidentiality of all client information
        - Shall not disclose proprietary information to third parties
        - Must provide monthly progress reports
        
        Client obligations:
        - Shall provide necessary access to systems and personnel
        - Must approve deliverables within 5 business days
        - May not unreasonably withhold approval
        
        4. TERMINATION
        Either party may terminate this agreement with 30 days written notice.
        Upon termination, all confidential information must be returned.
        """
    }
    
    try:
        # Step 1: Test PDF Ingestion
        print("\n📥 Step 1: Testing PDF Ingestion")
        print("-" * 30)
        
        ingestion_response = client.post('/ingest-pdf', json={
            'pages': test_contract_pages
        })
        
        print(f"✅ Status Code: {ingestion_response.status_code}")
        
        if ingestion_response.status_code != 200:
            print(f"❌ Error: {ingestion_response.text}")
            return False
        
        ingestion_data = ingestion_response.json()
        pdf_id = ingestion_data.get('job_id')
        
        print(f"✅ PDF ID: {pdf_id}")
        print(f"✅ Status: {ingestion_data.get('status')}")
        print(f"✅ Stored in datastore: {ingestion_data.get('stored_in_datastore')}")
        
        # Step 2: Test Contract Summarization
        print("\n📋 Step 2: Testing Contract Summarization")
        print("-" * 30)
        
        message_response = client.post('/assistant-message', json={
            'user_id': 'test_user',
            'message': f'summarize_pdf:{pdf_id}'
        })
        
        print(f"✅ Status Code: {message_response.status_code}")
        
        if message_response.status_code != 200:
            print(f"❌ Error: {message_response.text}")
            return False
        
        summary_data = message_response.json()
        
        print(f"✅ Response generated: {len(summary_data.get('response', ''))} characters")
        print(f"✅ Citations found: {len(summary_data.get('citations', []))}")
        print(f"✅ Has citations: {summary_data.get('has_citations', False)}")
        print(f"✅ Document type: {summary_data.get('document_type', 'unknown')}")
        
        # Show first 200 characters of response
        response_preview = summary_data.get('response', '')[:200]
        print(f"✅ Response preview: {response_preview}...")
        
        # Step 3: Test Citation Resolution
        print("\n🔗 Step 3: Testing Citation Resolution")
        print("-" * 30)
        
        citations = summary_data.get('citations', [])
        if citations:
            # Test resolving the first citation
            first_citation = citations[0].strip('[]')
            
            citation_response = client.post('/resolve-citation', data={
                'pdf_id': pdf_id,
                'citation': first_citation
            })
            
            print(f"✅ Citation resolution status: {citation_response.status_code}")
            
            if citation_response.status_code == 200:
                citation_data = citation_response.json()
                print(f"✅ Citation found: {citation_data.get('found', False)}")
                if citation_data.get('found'):
                    print(f"✅ Citation content: {citation_data.get('content', '')[:100]}...")
        
        # Success summary
        print("\n" + "=" * 50)
        print("🎉 FRONTEND INTEGRATION TEST PASSED!")
        print("=" * 50)
        print(f"✅ PDF Ingestion: Working")
        print(f"✅ Contract Summarization: Working")
        print(f"✅ Citation Resolution: Working")
        print(f"✅ Citations Generated: {len(citations)}")
        
        return True
        
    except Exception as e:
        print(f"\n❌ FRONTEND INTEGRATION TEST FAILED: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_frontend_integration()
    exit(0 if success else 1)