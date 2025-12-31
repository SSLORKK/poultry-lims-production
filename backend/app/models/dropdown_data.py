from sqlalchemy import Column, Integer, String, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.db.base import Base


class Company(Base):
    __tablename__ = "companies"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    is_active = Column(Boolean, default=True)


class Farm(Base):
    __tablename__ = "farms"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    
    company = relationship("Company")


class Flock(Base):
    __tablename__ = "flocks"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    is_active = Column(Boolean, default=True)


class Cycle(Base):
    __tablename__ = "cycles"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    is_active = Column(Boolean, default=True)


class Status(Base):
    __tablename__ = "statuses"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    is_active = Column(Boolean, default=True)


class House(Base):
    __tablename__ = "houses"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    is_active = Column(Boolean, default=True)


class Source(Base):
    __tablename__ = "sources"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    is_active = Column(Boolean, default=True)


class SampleType(Base):
    __tablename__ = "sample_types"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    is_active = Column(Boolean, default=True)
    
    department = relationship("Department")


class Disease(Base):
    __tablename__ = "diseases"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    is_active = Column(Boolean, default=True)
    
    department = relationship("Department")


class KitType(Base):
    __tablename__ = "kit_types"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    is_active = Column(Boolean, default=True)
    
    department = relationship("Department")


class Technician(Base):
    __tablename__ = "technicians"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    is_active = Column(Boolean, default=True)


class Signature(Base):
    __tablename__ = "signatures"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    pin_hash = Column(String, nullable=False)
    signature_image = Column(String, nullable=True)  # Base64 encoded handwritten signature image
    is_active = Column(Boolean, default=True)


class ExtractionMethod(Base):
    __tablename__ = "extraction_methods"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    is_active = Column(Boolean, default=True)


class CultureIsolationType(Base):
    __tablename__ = "culture_isolation_types"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    is_active = Column(Boolean, default=True)


class PathogenicFungiMold(Base):
    __tablename__ = "pathogenic_fungi_mold"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    is_active = Column(Boolean, default=True)


class CultureScreenedPathogen(Base):
    __tablename__ = "culture_screened_pathogens"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    is_active = Column(Boolean, default=True)


class ASTDisk(Base):
    __tablename__ = "ast_disks"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    r_value = Column(String, nullable=True)  # Resistant breakpoint
    i_value = Column(String, nullable=True)  # Intermediate breakpoint
    s_value = Column(String, nullable=True)  # Susceptible breakpoint
    is_active = Column(Boolean, default=True)


class ASTDiskFastidious(Base):
    __tablename__ = "ast_disks_fastidious"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    r_value = Column(String, nullable=True)
    i_value = Column(String, nullable=True)
    s_value = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)


class ASTDiskStaphylococcus(Base):
    __tablename__ = "ast_disks_staphylococcus"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    r_value = Column(String, nullable=True)
    i_value = Column(String, nullable=True)
    s_value = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)


class ASTDiskEnterococcus(Base):
    __tablename__ = "ast_disks_enterococcus"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    r_value = Column(String, nullable=True)
    i_value = Column(String, nullable=True)
    s_value = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
