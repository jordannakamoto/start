#!/usr/bin/env python3
"""
Test script to verify workflow status publishing works
"""

import asyncio
from core.pdf_service import PDFService
from frontend_api.status_publisher import status_publisher

async def test_workflow_status():
    """Test that workflow status publishing works"""
    
    # Create a simple PDF service
    pdf_service = PDFService()
    
    # Test data
    test_pages = {
        "1": "This is a test contract. Party A must provide services. Party B shall pay within 30 days.",
        "2": "Additional contract terms and conditions apply."
    }
    
    print("🧪 Testing workflow status publishing...")
    
    # Test 1: PDF Ingestion
    print("\n1. Testing PDF ingestion...")
    ingestion_result = await pdf_service.ingest_pdf(test_pages)
    pdf_id = ingestion_result["job_id"]
    print(f"✅ PDF ingested with ID: {pdf_id}")
    
    # Test 2: Check initial status
    print("\n2. Checking initial status...")
    status = status_publisher.get_status(pdf_id)
    if status:
        print(f"✅ Initial status found: {status['overall_status']}")
    else:
        print("❌ No initial status found")
    
    # Test 3: Full workflow with status tracking
    print("\n3. Testing full workflow with status tracking...")
    
    # This should trigger the workflow with status publishing
    summary_result = await pdf_service.process_pdf_summary(pdf_id)
    
    # Test 4: Check final status
    print("\n4. Checking final status...")
    final_status = status_publisher.get_status(pdf_id)
    if final_status:
        print(f"✅ Final status: {final_status['overall_status']}")
        print(f"✅ Progress: {final_status['progress_percent']}%")
        print(f"✅ Current step: {final_status['current_step']}")
        print(f"✅ Steps completed: {list(final_status['steps'].keys())}")
    else:
        print("❌ No final status found")
    
    # Test 5: Check history
    print("\n5. Checking status history...")
    history = status_publisher.get_history(pdf_id)
    if history:
        print(f"✅ History entries: {len(history)}")
        for entry in history[:3]:  # Show first 3 entries
            print(f"   - {entry['step_name']}: {entry['status']} - {entry['message']}")
    else:
        print("❌ No history found")
    
    # Test 6: Check active workflows
    print("\n6. Checking active workflows...")
    active_workflows = status_publisher.get_all_active_workflows()
    print(f"✅ Active workflows: {len(active_workflows)}")
    
    print("\n🎉 Status publishing test completed!")
    return summary_result

if __name__ == "__main__":
    result = asyncio.run(test_workflow_status())
    print(f"\n📋 Final result keys: {list(result.keys()) if isinstance(result, dict) else 'Not a dict'}")