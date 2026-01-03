# POULTRY LIMS - SECURITY FIX TODO LIST
**Created:** January 2, 2026  
**Total Tasks:** 38  
**Estimated Total Time:** 4-6 weeks

---

## PRIORITY 1 - CRITICAL (Complete Within Week 1)
> **These issues must be fixed before production deployment**

### ☐ 1.1 Replace Hardcoded SECRET_KEY
**File:** `backend/app/core/config.py`  
**Line:** 13  
**Time:** 15 minutes

**Current Code:**
```python
SECRET_KEY: str = "your-secret-key-change-in-production"
```

**Fix:**
```python
SECRET_KEY: str = os.getenv("SECRET_KEY", "")
```

**Also update `.env`:**
```env
SECRET_KEY=your-super-secure-random-key-here-min-32-chars
```

**Generate secure key with:**
```python
import secrets
print(secrets.token_urlsafe(32))
```

---

### ☐ 1.2 Add SECRET_KEY Validation
**File:** `backend/app/core/config.py`  
**Time:** 15 minutes

**Add after Settings class:**
```python
# Validate SECRET_KEY in production
import os
if os.getenv("ENVIRONMENT", "development") == "production":
    if not settings.SECRET_KEY or settings.SECRET_KEY == "your-secret-key-change-in-production":
        raise ValueError("SECRET_KEY must be set to a secure value in production!")
    if len(settings.SECRET_KEY) < 32:
        raise ValueError("SECRET_KEY must be at least 32 characters long!")
```

---

### ☐ 1.3 Reduce JWT Token Expiration
**File:** `backend/app/core/config.py`  
**Line:** 15  
**Time:** 5 minutes

**Current Code:**
```python
ACCESS_TOKEN_EXPIRE_MINUTES: int = 525600  # 365 days
```

**Fix:**
```python
ACCESS_TOKEN_EXPIRE_MINUTES: int = 30  # 30 minutes for access tokens
REFRESH_TOKEN_EXPIRE_DAYS: int = 7     # 7 days for refresh tokens
```

---

### ☐ 1.4 Implement Refresh Token Mechanism
**File:** `backend/app/core/security.py`  
**Time:** 2 hours

**Add new functions:**
```python
def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def verify_refresh_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "refresh":
            return None
        return payload
    except JWTError:
        return None
```

**Add new endpoint in `backend/app/api/v1/routers/auth.py`:**
```python
@router.post("/refresh", response_model=Token)
def refresh_token(refresh_token: str, db: Session = Depends(get_db)):
    payload = verify_refresh_token(refresh_token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    
    username = payload.get("sub")
    user = UserService(db).get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    new_access_token = create_access_token(data={"sub": user.username, "role": user.role.value})
    return Token(access_token=new_access_token, token_type="bearer")
```

---

### ☐ 1.5 Fix CORS Configuration
**File:** `backend/app/main.py`  
**Lines:** 32-38  
**Time:** 15 minutes

**Current Code:**
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Fix:**
```python
# Add to config.py
ALLOWED_ORIGINS: List[str] = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")

# Update main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["Authorization", "Content-Type"],
)
```

**Add to `.env`:**
```env
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

---

### ☐ 1.6 Add Password Strength Validation
**File:** `backend/app/schemas/user.py`  
**Time:** 30 minutes

**Add validation to UserCreate:**
```python
from pydantic import BaseModel, field_validator
import re

class UserCreate(UserBase):
    password: str
    
    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not re.search(r'\d', v):
            raise ValueError('Password must contain at least one digit')
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', v):
            raise ValueError('Password must contain at least one special character')
        return v
```

---

### ☐ 1.7 Implement Rate Limiting
**File:** `backend/app/main.py` and new file `backend/app/core/rate_limit.py`  
**Time:** 1 hour

**Install dependency:**
```bash
pip install slowapi
```

**Add to requirements.txt:**
```
slowapi==0.1.9
```

**Create `backend/app/core/rate_limit.py`:**
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
```

**Update `backend/app/main.py`:**
```python
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.core.rate_limit import limiter

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
```

**Update `backend/app/api/v1/routers/auth.py`:**
```python
from app.core.rate_limit import limiter

@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
def login(request: Request, login_data: LoginRequest, db: Session = Depends(get_db)):
    # ... existing code
```

---

### ☐ 1.8 Sanitize Error Responses
**File:** `backend/app/main.py`  
**Lines:** 74-106  
**Time:** 30 minutes

**Fix:**
```python
import os

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle all unhandled exceptions"""
    # Log full error details server-side
    logger.error(f"Unhandled exception on {request.method} {request.url.path}")
    logger.error(f"Error: {type(exc).__name__}: {str(exc)}")
    logger.error(traceback.format_exc())
    
    # Return sanitized response to client
    is_development = os.getenv("ENVIRONMENT", "development") == "development"
    
    if is_development:
        # More details in development
        return JSONResponse(
            status_code=500,
            content={
                "error": True,
                "message": str(exc),
                "detail": "Internal server error"
            }
        )
    else:
        # Generic message in production
        return JSONResponse(
            status_code=500,
            content={
                "error": True,
                "message": "An unexpected error occurred",
                "detail": "Please contact support if the problem persists"
            }
        )
```

---

## PRIORITY 2 - HIGH (Complete Within Month 1)

### ☐ 2.1 Implement CSRF Protection
**File:** New file `backend/app/middleware/csrf.py`  
**Time:** 2 hours

**Install:**
```bash
pip install fastapi-csrf-protect
```

**Implementation:**
```python
from fastapi_csrf_protect import CsrfProtect
from pydantic import BaseModel

class CsrfSettings(BaseModel):
    secret_key: str = settings.SECRET_KEY

@CsrfProtect.load_config
def get_csrf_config():
    return CsrfSettings()
```

---

### ☐ 2.2 Add Account Lockout
**File:** `backend/app/models/user.py` and `backend/app/services/auth_service.py`  
**Time:** 2 hours

**Add to User model:**
```python
failed_login_attempts = Column(Integer, default=0)
locked_until = Column(DateTime, nullable=True)
```

**Update auth_service.py:**
```python
def authenticate_user(self, login_data: LoginRequest) -> Optional[Token]:
    user = self.user_repo.get_by_username(login_data.username)
    if not user:
        return None
    
    # Check if account is locked
    if user.locked_until and user.locked_until > datetime.utcnow():
        raise HTTPException(
            status_code=423,
            detail=f"Account locked. Try again after {user.locked_until}"
        )
    
    if not verify_password(login_data.password, user.hashed_password):
        # Increment failed attempts
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= 5:
            user.locked_until = datetime.utcnow() + timedelta(minutes=15)
        self.user_repo.db.commit()
        return None
    
    # Reset on successful login
    user.failed_login_attempts = 0
    user.locked_until = None
    self.user_repo.db.commit()
    
    # ... rest of the function
```

---

### ☐ 2.3 Add Security Headers
**File:** `backend/app/main.py`  
**Time:** 30 minutes

**Add middleware:**
```python
from starlette.middleware.base import BaseHTTPMiddleware

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = "default-src 'self'"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response

app.add_middleware(SecurityHeadersMiddleware)
```

---

### ☐ 2.4 Enhance File Upload Security
**File:** `backend/app/api/v1/routers/users.py`  
**Time:** 1 hour

**Add magic number verification:**
```python
import magic  # pip install python-magic

ALLOWED_MIME_TYPES = {
    b'\xff\xd8\xff': 'image/jpeg',
    b'\x89PNG\r\n\x1a\n': 'image/png',
    b'GIF87a': 'image/gif',
    b'GIF89a': 'image/gif',
    b'RIFF': 'image/webp',
}

def verify_file_type(file_content: bytes) -> bool:
    """Verify file type by magic numbers, not just Content-Type header"""
    for magic_bytes, mime in ALLOWED_MIME_TYPES.items():
        if file_content.startswith(magic_bytes):
            return True
    return False

# In upload_profile_picture function:
content = await file.read()
if not verify_file_type(content):
    raise HTTPException(status_code=400, detail="Invalid file type")
```

---

### ☐ 2.5 Add Input Sanitization
**File:** New file `backend/app/core/sanitization.py`  
**Time:** 1 hour

**Install:**
```bash
pip install bleach
```

**Create sanitization module:**
```python
import bleach
import re

def sanitize_string(value: str) -> str:
    """Remove potentially dangerous characters from string input"""
    if not value:
        return value
    # Remove HTML tags
    cleaned = bleach.clean(value, tags=[], strip=True)
    # Remove script-like patterns
    cleaned = re.sub(r'javascript:', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'on\w+\s*=', '', cleaned, flags=re.IGNORECASE)
    return cleaned.strip()

def sanitize_search(value: str, max_length: int = 100) -> str:
    """Sanitize search input"""
    if not value:
        return value
    # Limit length
    value = value[:max_length]
    # Remove SQL special characters
    value = re.sub(r'[;\'"\\]', '', value)
    return sanitize_string(value)
```

---

### ☐ 2.6 Fix Permission Checks
**File:** `backend/app/api/v1/routers/samples.py`  
**Time:** 30 minutes

**Current Code:**
```python
if current_user.role == "admin":
```

**Fix:**
```python
from app.models.user import UserRole

if current_user.role == UserRole.admin:
```

---

### ☐ 2.7 Remove Hardcoded Department IDs
**File:** `backend/app/api/v1/routers/samples.py`  
**Time:** 1 hour

**Current Code:**
```python
allowed_dept_ids.add(1)  # PCR department ID
allowed_dept_ids.add(2)  # Serology department ID
allowed_dept_ids.add(3)  # Microbiology department ID
```

**Fix - Create mapping in config or database:**
```python
# In config.py or as database lookup
DEPARTMENT_PERMISSION_MAP = {
    "Database - PCR": "PCR",
    "Database - Serology": "Serology",
    "Database - Microbiology": "Microbiology",
}

# In samples.py
from app.repositories import DepartmentRepository

dept_repo = DepartmentRepository(db)
for perm in user_permissions:
    dept_name = DEPARTMENT_PERMISSION_MAP.get(perm.screen_name)
    if dept_name and perm.can_read:
        dept = dept_repo.get_by_name(dept_name)
        if dept:
            allowed_dept_ids.add(dept.id)
```

---

### ☐ 2.8 Add Write Permission Checks on Sample Creation
**File:** `backend/app/api/v1/routers/samples.py`  
**Time:** 30 minutes

**Add permission check:**
```python
@router.post("/", response_model=SampleResponse, status_code=status.HTTP_201_CREATED)
def create_sample(
    sample_data: SampleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Check write permissions
    permission_repo = PermissionRepository(db)
    user_permissions = permission_repo.get_user_permissions(current_user.id)
    
    has_write_permission = False
    for perm in user_permissions:
        if perm.can_write and "Database" in perm.screen_name:
            has_write_permission = True
            break
    
    if not has_write_permission and current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to create samples"
        )
    
    # ... rest of function
```

---

### ☐ 2.9 Implement Token Blacklist
**File:** New model and service  
**Time:** 2 hours

**Create model `backend/app/models/token_blacklist.py`:**
```python
from sqlalchemy import Column, Integer, String, DateTime
from app.db.base import Base

class TokenBlacklist(Base):
    __tablename__ = "token_blacklist"
    
    id = Column(Integer, primary_key=True, index=True)
    token = Column(String, unique=True, index=True, nullable=False)
    blacklisted_at = Column(DateTime, nullable=False)
    expires_at = Column(DateTime, nullable=False)
```

**Add logout endpoint:**
```python
@router.post("/logout")
def logout(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    token = credentials.credentials
    # Add token to blacklist
    blacklist_entry = TokenBlacklist(
        token=token,
        blacklisted_at=datetime.utcnow(),
        expires_at=datetime.utcnow() + timedelta(days=1)
    )
    db.add(blacklist_entry)
    db.commit()
    return {"message": "Successfully logged out"}
```

---

### ☐ 2.10 Add Email Validation
**File:** `backend/app/schemas/user.py`  
**Time:** 15 minutes

**Add to UserCreate:**
```python
from pydantic import EmailStr

class UserCreate(UserBase):
    password: str
    email: EmailStr  # Add email field with validation
```

---

## PRIORITY 3 - MEDIUM (Complete Within Month 2-3)

### ☐ 3.1 Implement Two-Factor Authentication (TOTP)
**Time:** 4-6 hours
- Install `pyotp` library
- Add `totp_secret` field to User model
- Create 2FA setup endpoint
- Create 2FA verify endpoint
- Update login flow to check 2FA

---

### ☐ 3.2 Add Audit Logging
**Time:** 3-4 hours
- Create AuditLog model
- Add logging middleware
- Log authentication events
- Log data modifications
- Log permission changes

---

### ☐ 3.3 Implement Session Management UI
**Time:** 4-6 hours
- Create Session model
- Track active sessions
- Add endpoints to list/revoke sessions
- Frontend UI for session management

---

### ☐ 3.4 Add Password Reset
**Time:** 3-4 hours
- Create PasswordResetToken model
- Add forgot-password endpoint
- Add reset-password endpoint
- Email integration for reset links

---

### ☐ 3.5 Implement Inactivity Timeout
**Time:** 2 hours
- Add last_activity field to sessions
- Check activity on each request
- Auto-expire inactive sessions

---

### ☐ 3.6 Add Device Fingerprinting
**Time:** 2-3 hours
- Capture device info on login
- Store device fingerprint with session
- Alert on new device login

---

### ☐ 3.7 Implement Concurrent Session Limits
**Time:** 1-2 hours
- Track session count per user
- Limit to configurable number
- Revoke oldest session when limit reached

---

### ☐ 3.8 Add HTTPS Enforcement
**Time:** 1 hour
- Add redirect middleware
- Configure secure cookies
- Add HSTS headers

---

## PRIORITY 4 - LOW (Ongoing)

### ☐ 4.1 Remove Debug Print Statements
**Files:** Multiple  
**Time:** 30 minutes
- Search for `print(` in codebase
- Replace with `logger.debug()` or remove

---

### ☐ 4.2 Replace Print with Logging
**Time:** 1 hour
- Standardize logging configuration
- Use appropriate log levels
- Add structured logging

---

### ☐ 4.3-4.5 Add Tests
**Time:** 8-16 hours
- Unit tests for auth
- Integration tests for API
- Security tests

---

### ☐ 4.6 API Versioning Strategy
**Time:** 2 hours
- Document versioning policy
- Add deprecation headers
- Version lifecycle management

---

### ☐ 4.7 Dependency Vulnerability Scanning
**Time:** 1 hour
- Set up `pip-audit` or `safety`
- Add to CI/CD pipeline
- Regular scanning schedule

---

### ☐ 4.8 Security Documentation
**Time:** 2-4 hours
- Document security architecture
- Create security guidelines
- Developer security training

---

## PROGRESS TRACKER

| Priority | Total | Completed | Progress |
|----------|-------|-----------|----------|
| Critical | 8 | 0 | ░░░░░░░░░░ 0% |
| High | 10 | 0 | ░░░░░░░░░░ 0% |
| Medium | 8 | 0 | ░░░░░░░░░░ 0% |
| Low | 8 | 0 | ░░░░░░░░░░ 0% |
| **Total** | **34** | **0** | ░░░░░░░░░░ **0%** |

---

## NOTES

- Complete Critical items before ANY production deployment
- Test each fix thoroughly before moving to next
- Create database migrations for model changes
- Update frontend to handle new auth flow (refresh tokens)
- Consider using feature flags for gradual rollout

---

**Last Updated:** January 2, 2026
