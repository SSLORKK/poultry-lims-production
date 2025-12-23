"""
Redis cache service for performance optimization
"""
import json
import redis
from typing import Optional, Any
from functools import wraps
import os

# Redis connection
redis_client: Optional[redis.Redis] = None

def get_redis_client() -> Optional[redis.Redis]:
    """Get Redis client instance"""
    global redis_client
    
    if redis_client is None:
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        cache_enabled = os.getenv("CACHE_ENABLED", "true").lower() == "true"
        
        if not cache_enabled:
            return None
            
        try:
            redis_client = redis.from_url(
                redis_url,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5
            )
            # Test connection
            redis_client.ping()
            print(f"✓ Redis cache connected: {redis_url}")
        except Exception as e:
            print(f"⚠️  Redis cache unavailable: {e}")
            redis_client = None
    
    return redis_client


def cache_key(*args, **kwargs) -> str:
    """Generate cache key from arguments"""
    key_parts = [str(arg) for arg in args]
    key_parts.extend([f"{k}:{v}" for k, v in sorted(kwargs.items())])
    return ":".join(key_parts)


def get_cache(key: str) -> Optional[Any]:
    """Get value from cache"""
    client = get_redis_client()
    if not client:
        return None
    
    try:
        value = client.get(key)
        if value:
            return json.loads(value)
    except Exception as e:
        print(f"Cache get error: {e}")
    
    return None


def set_cache(key: str, value: Any, ttl: int = 300) -> bool:
    """Set value in cache with TTL (default 5 minutes)"""
    client = get_redis_client()
    if not client:
        return False
    
    try:
        serialized = json.dumps(value, default=str)
        client.setex(key, ttl, serialized)
        return True
    except Exception as e:
        print(f"Cache set error: {e}")
        return False


def delete_cache(pattern: str) -> int:
    """Delete cache keys matching pattern"""
    client = get_redis_client()
    if not client:
        return 0
    
    try:
        keys = client.keys(pattern)
        if keys:
            return client.delete(*keys)
    except Exception as e:
        print(f"Cache delete error: {e}")
    
    return 0


def cached(prefix: str, ttl: int = 300):
    """
    Decorator to cache function results
    
    Usage:
        @cached("samples", ttl=600)
        def get_samples(skip: int = 0, limit: int = 100):
            return db.query(Sample).offset(skip).limit(limit).all()
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Generate cache key
            key = f"{prefix}:{cache_key(*args, **kwargs)}"
            
            # Try to get from cache
            cached_value = get_cache(key)
            if cached_value is not None:
                return cached_value
            
            # Execute function
            result = func(*args, **kwargs)
            
            # Store in cache
            set_cache(key, result, ttl)
            
            return result
        
        return wrapper
    return decorator


def invalidate_cache(prefix: str):
    """
    Decorator to invalidate cache after function execution
    
    Usage:
        @invalidate_cache("samples")
        def create_sample(data):
            # ... create sample
            return sample
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            result = func(*args, **kwargs)
            delete_cache(f"{prefix}:*")
            return result
        
        return wrapper
    return decorator
