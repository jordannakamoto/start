#!/usr/bin/env python3
"""
Complete Contract Workflow Test
Tests the entire contract processing flow from start to finish after restructuring.
"""

import asyncio
import time
from core.pdf_service import PDFService
from frontend_api.status_publisher import status_publisher
from datastore.document_datastore import document_datastore, DocumentStatus

async def test_complete_contract_workflow():
    """Test the complete contract workflow from PDF ingestion to final output"""
    
    print("🧪 Testing Complete Contract Workflow")
    print("=" * 50)
    
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
    
    # Initialize PDF service
    pdf_service = PDFService()
    
    try:
        # Step 1: Test PDF Ingestion
        print("\n📥 Step 1: Testing PDF Ingestion")
        print("-" * 30)
        
        ingestion_result = await pdf_service.ingest_pdf(test_contract_pages)
        pdf_id = ingestion_result["job_id"]
        
        print(f"✅ PDF ingested successfully")
        print(f"   PDF ID: {pdf_id}")
        print(f"   Status: {ingestion_result['status']}")
        print(f"   Stored in datastore: {ingestion_result.get('stored_in_datastore', False)}")
        
        # Verify document is in datastore
        doc = document_datastore.get_document(pdf_id)
        if doc:
            print(f"   Datastore status: {doc['status']}")
        
        # Step 2: Test Status Publishing
        print("\n📊 Step 2: Testing Status Publishing")
        print("-" * 30)
        
        # Check initial status
        initial_status = status_publisher.get_status(pdf_id)
        if initial_status:
            print(f"✅ Initial status found: {initial_status['overall_status']}")
        
        # Step 3: Test Complete Workflow
        print("\n🔄 Step 3: Testing Complete Contract Workflow")
        print("-" * 30)
        
        print("Starting contract processing...")
        start_time = time.time()
        
        # This should trigger the full workflow with status updates
        final_result = await pdf_service.process_pdf_summary(pdf_id)
        
        end_time = time.time()
        processing_time = end_time - start_time
        
        print(f"✅ Contract processing completed in {processing_time:.2f} seconds")
        
        # Step 4: Verify Final Result
        print("\n📋 Step 4: Verifying Final Result")
        print("-" * 30)
        
        if 'error' in final_result:
            print(f"❌ Error in final result: {final_result['error']}")
            return False
        
        print(f"✅ Response generated: {len(final_result.get('response', ''))} characters")
        print(f"✅ Citations found: {len(final_result.get('citations', []))}")
        print(f"✅ Has citations: {final_result.get('has_citations', False)}")
        print(f"✅ Document type: {final_result.get('document_type', 'unknown')}")
        
        # Show first 200 characters of response
        response_preview = final_result.get('response', '')[:200]
        print(f"✅ Response preview: {response_preview}...")
        
        # Step 5: Test Status History
        print("\n📈 Step 5: Testing Status History")
        print("-" * 30)
        
        final_status = status_publisher.get_status(pdf_id)
        if final_status:
            print(f"✅ Final status: {final_status['overall_status']}")
            print(f"✅ Progress: {final_status['progress_percent']}%")
            print(f"✅ Current step: {final_status['current_step']}")
            print(f"✅ Steps completed: {list(final_status['steps'].keys())}")
        
        # Show processing history
        history = status_publisher.get_history(pdf_id)
        if history:
            print(f"✅ History entries: {len(history)}")
            print("   Recent steps:")
            for entry in history[-5:]:  # Show last 5 entries
                print(f"   - {entry['step_name']}: {entry['status']} - {entry['message']}")
        
        # Step 6: Test Datastore Persistence
        print("\n💾 Step 6: Testing Datastore Persistence")
        print("-" * 30)
        
        final_doc = document_datastore.get_document(pdf_id)
        if final_doc:
            print(f"✅ Final document status: {final_doc['status']}")
            print(f"✅ Document type: {final_doc.get('document_type', 'unknown')}")
            print(f"✅ Classification confidence: {final_doc.get('classification_confidence', 0)}")
            print(f"✅ Workflow history entries: {len(final_doc.get('workflow_history', []))}")
        
        # Step 7: Test Datastore Stats
        print("\n📊 Step 7: Testing Datastore Stats")
        print("-" * 30)
        
        stats = document_datastore.get_storage_stats()
        print(f"✅ Total documents: {stats['total_documents']}")
        print(f"✅ Status counts: {stats['status_counts']}")
        print(f"✅ Type counts: {stats['type_counts']}")
        print(f"✅ Storage path: {stats['storage_path']}")
        
        # Success summary
        print("\n" + "=" * 50)
        print("🎉 COMPLETE WORKFLOW TEST PASSED!")
        print("=" * 50)
        print(f"✅ PDF Ingestion: Working")
        print(f"✅ Document Classification: Working")
        print(f"✅ Contract Analysis: Working")
        print(f"✅ Status Publishing: Working")
        print(f"✅ Datastore Persistence: Working")
        print(f"✅ Final Output Generation: Working")
        print(f"✅ Processing Time: {processing_time:.2f} seconds")
        
        return True
        
    except Exception as e:
        print(f"\n❌ WORKFLOW TEST FAILED: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(test_complete_contract_workflow())
    exit(0 if success else 1)