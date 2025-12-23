from pydantic import BaseModel
from typing import Optional


class DropdownBase(BaseModel):
    name: str


class DropdownCreate(DropdownBase):
    pass


class DropdownUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None


class DropdownResponse(DropdownBase):
    id: int
    is_active: bool
    
    class Config:
        from_attributes = True


class DepartmentDropdownBase(BaseModel):
    name: str
    department_id: int


class DepartmentDropdownCreate(DepartmentDropdownBase):
    pass


class DepartmentDropdownUpdate(BaseModel):
    name: Optional[str] = None
    department_id: Optional[int] = None
    is_active: Optional[bool] = None


class DepartmentDropdownResponse(DepartmentDropdownBase):
    id: int
    is_active: bool
    
    class Config:
        from_attributes = True


# Signature schemas for e-signature system
class SignatureCreate(BaseModel):
    name: str
    pin: str  # Plain text PIN, will be hashed on server
    signature_image: Optional[str] = None  # Base64 encoded handwritten signature image


class SignatureResponse(BaseModel):
    id: int
    name: str
    signature_image: Optional[str] = None
    is_active: bool
    
    class Config:
        from_attributes = True


class PINVerifyRequest(BaseModel):
    pin: str


class PINVerifyResponse(BaseModel):
    name: str
    is_valid: bool
    signature_image: Optional[str] = None  # Return signature image when PIN is verified
