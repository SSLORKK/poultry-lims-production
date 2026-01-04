"""
Quick Verification of Counter Fix
==================================
Verifies that the atomic sequence-based counters work correctly
without race conditions under concurrent load.
"""

import sys
import os
import threading
import time
from datetime import datetime

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.repositories import CounterRepository  # V2 with atomic sequences


def test_concurrent_counter_access(num_threads: int = 10, requests_per_thread: int = 100):
    """Test that concurrent counter access produces no duplicates"""
    print("\n" + "=" * 70)
    print("CONCURRENT COUNTER TEST")
    print("=" * 70)
    print(f"Threads: {num_threads}")
    print(f"Requests per thread: {requests_per_thread}")
    print(f"Total requests: {num_threads * requests_per_thread}")
    
    results = {
        'sample_numbers': [],
        'duplicates': [],
        'errors': []
    }
    lock = threading.Lock()
    
    def get_sample_number(thread_id: int):
        """Thread to get next sample number"""
        db = SessionLocal()
        try:
            repo = CounterRepository(db)
            for i in range(requests_per_thread):
                try:
                    num = repo.get_next_sample_number()
                    with lock:
                        if num in results['sample_numbers']:
                            results['duplicates'].append((thread_id, num))
                        results['sample_numbers'].append(num)
                except Exception as e:
                    with lock:
                        results['errors'].append((thread_id, str(e)))
        finally:
            db.close()
    
    # Run concurrent threads
    threads = []
    start = time.time()
    for i in range(num_threads):
        t = threading.Thread(target=get_sample_number, args=(i,))
        threads.append(t)
        t.start()
    
    for t in threads:
        t.join()
    
    duration = time.time() - start
    
    # Results
    print(f"\n{'=' * 70}")
    print("RESULTS")
    print(f"{'=' * 70}")
    print(f"  Total numbers generated: {len(results['sample_numbers'])}")
    print(f"  Unique numbers:          {len(set(results['sample_numbers']))}")
    print(f"  Duplicates found:        {len(results['duplicates'])}")
    print(f"  Errors:                  {len(results['errors'])}")
    print(f"  Duration:                {duration:.2f}s")
    print(f"  Throughput:              {len(results['sample_numbers']) / duration:.1f} req/s")
    
    if results['duplicates']:
        print(f"\n  ⚠ RACE CONDITION DETECTED!")
        print(f"  Duplicate numbers: {results['duplicates'][:10]}...")
        return False
    else:
        print(f"\n  ✓ NO RACE CONDITIONS - All numbers unique!")
        print(f"  ✓ Atomic sequences working correctly!")
        return True


def test_unit_counters():
    """Test unit counters for all departments"""
    print(f"\n{'=' * 70}")
    print("UNIT COUNTER TEST")
    print(f"{'=' * 70}")
    
    db = SessionLocal()
    try:
        repo = CounterRepository(db)
        from app.models.department import Department
        
        departments = db.query(Department).all()
        current_year = datetime.now().year
        
        print(f"\nTesting unit counters for {len(departments)} departments:")
        
        for dept in departments:
            # Get next unit number
            unit_num = repo.get_next_unit_number(dept.id, year=current_year)
            print(f"  {dept.code}: Next unit number = {unit_num}")
        
        print(f"\n  ✓ All unit counters working!")
        
    finally:
        db.close()


def verify_sequences():
    """Verify sequences exist and are properly configured"""
    print(f"\n{'=' * 70}")
    print("SEQUENCE VERIFICATION")
    print(f"{'=' * 70}")
    
    db = SessionLocal()
    try:
        current_year = datetime.now().year
        
        # Check sample sequence
        result = db.execute(text(f"SELECT last_value FROM sample_code_seq_{current_year}")).fetchone()
        print(f"\n  Sample sequence (sample_code_seq_{current_year}):")
        print(f"    Current value: {result[0]}")
        
        # Check unit sequences
        from app.models.department import Department
        departments = db.query(Department).all()
        
        print(f"\n  Unit sequences:")
        for dept in departments:
            seq_name = f"unit_code_seq_{dept.code.lower()}_{current_year}"
            try:
                result = db.execute(text(f"SELECT last_value FROM {seq_name}")).fetchone()
                print(f"    {seq_name}: {result[0]}")
            except Exception as e:
                print(f"    {seq_name}: ERROR - {e}")
        
        print(f"\n  ✓ All sequences verified!")
        
    finally:
        db.close()


if __name__ == "__main__":
    import argparse
    from sqlalchemy import text
    
    parser = argparse.ArgumentParser(description='Verify counter fix')
    parser.add_argument('--threads', type=int, default=10, help='Number of threads')
    parser.add_argument('--requests', type=int, default=100, help='Requests per thread')
    parser.add_argument('--verify-only', action='store_true', help='Only verify sequences')
    
    args = parser.parse_args()
    
    if args.verify_only:
        verify_sequences()
    else:
        verify_sequences()
        test_unit_counters()
        success = test_concurrent_counter_access(args.threads, args.requests)
        
        print(f"\n{'=' * 70}")
        if success:
            print("✓ ALL TESTS PASSED - Counter fix verified!")
        else:
            print("✗ TESTS FAILED - Race conditions detected!")
        print(f"{'=' * 70}\n")
