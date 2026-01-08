from sqlalchemy.orm import Session
from app.models.pcr_coa import PCRCOA
from app.models.counter import Counter
from app.schemas.pcr_coa import PCRCOACreate, PCRCOAUpdate
from typing import Optional, List
from datetime import datetime


class PCRCOARepository:
    def __init__(self, db: Session):
        self.db = db

    def _generate_report_no(self) -> str:
        """Generate report number in format P(yy)-x, resets yearly"""
        current_year = datetime.now().year
        year_suffix = str(current_year)[-2:]  # Get last 2 digits of year
        
        # Get or create counter for PCR report numbers
        # Note: department_id is None for PCR reports (not department-specific)
        counter = self.db.query(Counter).filter(
            Counter.counter_type == "pcr_report",
            Counter.department_id == None,
            Counter.year == current_year
        ).with_for_update().first()
        
        # Find max existing report_no NUMERICALLY (not string sort!)
        # String sort fails: "P26-9" > "P26-10" because '9' > '1'
        existing_reports = self.db.query(PCRCOA.report_no).filter(
            PCRCOA.report_no.like(f"P{year_suffix}-%"),
            PCRCOA.report_no != None
        ).all()
        
        max_existing = 0
        for (report_no,) in existing_reports:
            if report_no:
                try:
                    num = int(report_no.split("-")[1])
                    if num > max_existing:
                        max_existing = num
                except (IndexError, ValueError):
                    pass
        
        if not counter:
            # Create new counter for this year
            counter = Counter(
                counter_type="pcr_report",
                department_id=None,
                year=current_year,
                current_value=max_existing
            )
            self.db.add(counter)
        elif counter.current_value < max_existing:
            # Sync counter if it's behind existing report numbers
            counter.current_value = max_existing
        
        # Increment counter
        counter.current_value += 1
        self.db.flush()
        
        return f"P{year_suffix}-{counter.current_value}"

    def get_by_unit_id(self, unit_id: int) -> Optional[PCRCOA]:
        return self.db.query(PCRCOA).filter(PCRCOA.unit_id == unit_id).first()

    def get_by_unit_ids(self, unit_ids: List[int]) -> List[PCRCOA]:
        """Batch fetch COAs by multiple unit IDs for performance"""
        return self.db.query(PCRCOA).filter(PCRCOA.unit_id.in_(unit_ids)).all()

    def create(self, coa_data: PCRCOACreate) -> PCRCOA:
        db_coa = PCRCOA(**coa_data.model_dump())
        self.db.add(db_coa)
        self.db.commit()
        self.db.refresh(db_coa)
        return db_coa

    def update(self, unit_id: int, coa_data: PCRCOAUpdate) -> Optional[PCRCOA]:
        db_coa = self.get_by_unit_id(unit_id)
        if not db_coa:
            return None
        
        update_data = coa_data.model_dump(exclude_unset=True)
        
        # Check if status is changing to 'completed' and report_no not yet assigned
        new_status = update_data.get('status')
        if new_status == 'completed' and not db_coa.report_no:
            db_coa.report_no = self._generate_report_no()
        
        for key, value in update_data.items():
            setattr(db_coa, key, value)
        
        self.db.commit()
        self.db.refresh(db_coa)
        return db_coa

    def delete(self, unit_id: int) -> bool:
        db_coa = self.get_by_unit_id(unit_id)
        if not db_coa:
            return False
        
        self.db.delete(db_coa)
        self.db.commit()
        return True
