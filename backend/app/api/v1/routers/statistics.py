from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta, date
from sqlalchemy import func, and_

from app.db.session import get_db
from app.models.sample import Sample
from app.models.unit import Unit
from app.models.department import Department
from app.models.pcr_data import PCRData
from app.models.serology_data import SerologyData
from app.models.microbiology_data import MicrobiologyData
from app.models.microbiology_coa import MicrobiologyCOA
from pydantic import BaseModel

router = APIRouter(prefix="/statistics", tags=["statistics"])


class StatisticPoint(BaseModel):
    date: str
    count: int
    test_count: int = 0
    label: str


class DepartmentStatistic(BaseModel):
    department_id: int
    department_name: str
    department_code: str
    data: List[StatisticPoint]
    sample_count: int = 0
    sub_sample_count: int = 0
    test_count: int = 0
    wells_count: int = 0


class SamplesStatisticsResponse(BaseModel):
    period: str
    data: List[StatisticPoint]
    total: int


class UnitsStatisticsResponse(BaseModel):
    period: str
    departments: List[DepartmentStatistic]
    total: int


def get_date_range(period: str):
    now = datetime.now()
    
    if period == "day":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        intervals = [(start_date + timedelta(hours=i), start_date + timedelta(hours=i+1)) for i in range(24)]
        format_label = lambda dt: dt.strftime("%H:00")
    elif period == "week":
        start_date = now - timedelta(days=now.weekday())
        start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
        intervals = [(start_date + timedelta(days=i), start_date + timedelta(days=i+1)) for i in range(7)]
        format_label = lambda dt: dt.strftime("%a")
    elif period == "month":
        start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        days_in_month = (start_date.replace(month=start_date.month % 12 + 1, day=1) - timedelta(days=1)).day
        intervals = [(start_date + timedelta(days=i), start_date + timedelta(days=i+1)) for i in range(days_in_month)]
        format_label = lambda dt: dt.strftime("%d")
    elif period == "year":
        start_date = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        intervals = [(start_date.replace(month=i), start_date.replace(month=i % 12 + 1) if i < 12 else start_date.replace(year=start_date.year + 1, month=1)) for i in range(1, 13)]
        format_label = lambda dt: dt.strftime("%b")
    else:
        raise ValueError(f"Invalid period: {period}")
    
    return intervals, format_label


@router.get("/samples", response_model=SamplesStatisticsResponse)
def get_samples_statistics(
    period: Optional[str] = Query(None, description="Time period: day, week, month, or year"),
    from_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    to_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    db: Session = Depends(get_db)
):
    if from_date and to_date:
        start_date = datetime.fromisoformat(from_date)
        end_date = datetime.fromisoformat(to_date)
        days = (end_date - start_date).days + 1
        intervals = [(start_date + timedelta(days=i), start_date + timedelta(days=i+1)) for i in range(days)]
        format_label = lambda dt: dt.strftime("%b %d")
        period_label = f"{from_date} to {to_date}"
    elif period:
        intervals, format_label = get_date_range(period)
        period_label = period
    else:
        intervals, format_label = get_date_range('week')
        period_label = 'week'
    
    data = []
    total = 0
    
    for start, end in intervals:
        if period_label == 'day':
            # Count MIC units
            mic_count = db.query(func.count(Unit.id)).join(Department).filter(
                and_(
                    Department.code == 'MIC',
                    Unit.created_at >= start,
                    Unit.created_at < end
                )
            ).scalar() or 0
            
            # Sum Other units
            other_count = db.query(func.sum(Unit.samples_number)).join(Department).filter(
                and_(
                    Department.code != 'MIC',
                    Unit.created_at >= start,
                    Unit.created_at < end
                )
            ).scalar() or 0
            
            count = mic_count + other_count
        else:
            # Count MIC units
            mic_count = db.query(func.count(Unit.id)).join(Department).join(Sample).filter(
                and_(
                    Department.code == 'MIC',
                    Sample.date_received >= start.date(),
                    Sample.date_received < end.date()
                )
            ).scalar() or 0
            
            # Sum Other units
            other_count = db.query(func.sum(Unit.samples_number)).join(Department).join(Sample).filter(
                and_(
                    Department.code != 'MIC',
                    Sample.date_received >= start.date(),
                    Sample.date_received < end.date()
                )
            ).scalar() or 0
            
            count = mic_count + other_count
        
        data.append(StatisticPoint(
            date=start.isoformat(),
            count=count,
            label=format_label(start)
        ))
        total += count
    
    return SamplesStatisticsResponse(
        period=period_label,
        data=data,
        total=total
    )


@router.get("/units", response_model=UnitsStatisticsResponse)
def get_units_statistics(
    period: Optional[str] = Query(None, description="Time period: day, week, month, or year"),
    from_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    to_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    department_id: int = Query(None, description="Optional department filter"),
    db: Session = Depends(get_db)
):
    if from_date and to_date:
        start_date = datetime.fromisoformat(from_date)
        end_date = datetime.fromisoformat(to_date)
        days = (end_date - start_date).days + 1
        intervals = [(start_date + timedelta(days=i), start_date + timedelta(days=i+1)) for i in range(days)]
        format_label = lambda dt: dt.strftime("%b %d")
        period_label = f"{from_date} to {to_date}"
        
        # Explicit query range for summaries (inclusive of end date's day)
        query_start = start_date
        query_end = end_date + timedelta(days=1)
    elif period:
        intervals, format_label = get_date_range(period)
        period_label = period
        
        # Derive query range from intervals
        query_start = intervals[0][0] if intervals else datetime.now()
        query_end = intervals[-1][1] if intervals else datetime.now()
    else:
        intervals, format_label = get_date_range('week')
        period_label = 'week'
        
        # Derive query range from intervals
        query_start = intervals[0][0] if intervals else datetime.now()
        query_end = intervals[-1][1] if intervals else datetime.now()
    
    departments_query = db.query(Department)
    if department_id:
        departments_query = departments_query.filter(Department.id == department_id)
    
    departments = departments_query.all()
    
    department_stats = []
    total = 0
    
    for dept in departments:
        data = []
        dept_total = 0
        
        # Use explicit query range for consistency
        first_interval_start = query_start
        last_interval_end = query_end
        
        # Calculate overall sample count for the department
        if dept.code == 'MIC':
            # For microbiology: samples = count of MIC units (1 per MIC code)
            sample_count = db.query(func.count(Unit.id)).join(
                Sample, Sample.id == Unit.sample_id
            ).filter(
                and_(
                    Unit.department_id == dept.id,
                    Sample.date_received >= first_interval_start.date(),
                    Sample.date_received < last_interval_end.date()
                )
            ).scalar() or 0
        elif dept.code == 'PCR':
            # For PCR: samples = count of PCR units (1 per PCR code)
            sample_count = db.query(func.count(Unit.id)).join(
                Sample, Sample.id == Unit.sample_id
            ).filter(
                and_(
                    Unit.department_id == dept.id,
                    Sample.date_received >= first_interval_start.date(),
                    Sample.date_received < last_interval_end.date()
                )
            ).scalar() or 0
        else:
            # For other departments (Serology): samples = sum of samples_number
            sample_count = db.query(func.sum(Unit.samples_number)).join(
                Sample, Sample.id == Unit.sample_id
            ).filter(
                and_(
                    Unit.department_id == dept.id,
                    Sample.date_received >= first_interval_start.date(),
                    Sample.date_received < last_interval_end.date()
                )
            ).scalar() or 0
        
        # Calculate sub-sample count
        sub_sample_count = 0
        if dept.code == 'MIC':
            # For microbiology: sub-samples = sum of samples_number
            sub_sample_count = db.query(func.sum(Unit.samples_number)).join(
                Sample, Sample.id == Unit.sample_id
            ).filter(
                and_(
                    Unit.department_id == dept.id,
                    Sample.date_received >= first_interval_start.date(),
                    Sample.date_received < last_interval_end.date()
                )
            ).scalar() or 0
        elif dept.code == 'PCR':
            # For PCR: sub-samples = sum of extraction values
            sub_sample_count = db.query(func.sum(PCRData.extraction)).join(
                Unit, Unit.id == PCRData.unit_id
            ).join(
                Sample, Sample.id == Unit.sample_id
            ).filter(
                and_(
                    Unit.department_id == dept.id,
                    Sample.date_received >= first_interval_start.date(),
                    Sample.date_received < last_interval_end.date()
                )
            ).scalar() or 0
        
        # Calculate test count for PCR, Serology, and Microbiology departments
        test_count = 0
        if dept.code == 'PCR':
            test_count = db.query(func.sum(PCRData.detection)).join(
                Unit, Unit.id == PCRData.unit_id
            ).join(
                Sample, Sample.id == Unit.sample_id
            ).filter(
                and_(
                    Unit.department_id == dept.id,
                    Sample.date_received >= first_interval_start.date(),
                    Sample.date_received < last_interval_end.date()
                )
            ).scalar() or 0
        elif dept.code == 'SER':
            test_count = db.query(func.sum(SerologyData.tests_count)).join(
                Unit, Unit.id == SerologyData.unit_id
            ).join(
                Sample, Sample.id == Unit.sample_id
            ).filter(
                and_(
                    Unit.department_id == dept.id,
                    Sample.date_received >= first_interval_start.date(),
                    Sample.date_received < last_interval_end.date()
                )
            ).scalar() or 0
        
        # Calculate wells count for Serology
        wells_count = 0
        if dept.code == 'SER':
            wells_count = db.query(func.sum(SerologyData.number_of_wells)).join(
                Unit, Unit.id == SerologyData.unit_id
            ).join(
                Sample, Sample.id == Unit.sample_id
            ).filter(
                and_(
                    Unit.department_id == dept.id,
                    Sample.date_received >= first_interval_start.date(),
                    Sample.date_received < last_interval_end.date()
                )
            ).scalar() or 0
        elif dept.code == 'MIC':
            # For microbiology: tests = sum of visible indexes per disease (excluding hidden indexes)
            mic_units = db.query(Unit).join(
                Sample, Sample.id == Unit.sample_id
            ).join(
                MicrobiologyData, Unit.id == MicrobiologyData.unit_id
            ).outerjoin(
                MicrobiologyCOA, Unit.id == MicrobiologyCOA.unit_id
            ).filter(
                and_(
                    Unit.department_id == dept.id,
                    Sample.date_received >= first_interval_start.date(),
                    Sample.date_received < last_interval_end.date()
                )
            ).all()
            
            test_count = 0
            for unit in mic_units:
                diseases_list = unit.microbiology_data.diseases_list or []
                index_list = unit.microbiology_data.index_list or []
                hidden_indexes = unit.microbiology_coa.hidden_indexes if unit.microbiology_coa else {}
                
                for disease in diseases_list:
                    # Get hidden indexes for this disease
                    disease_hidden = hidden_indexes.get(disease, []) if hidden_indexes else []
                    # Calculate visible indexes count
                    visible_count = len(index_list) - len(disease_hidden)
                    test_count += max(0, visible_count)
                
                # Count AST tests if ast_data is present and has results with interpretation
                if unit.microbiology_coa and unit.microbiology_coa.ast_data:
                    ast_data = unit.microbiology_coa.ast_data
                    ast_results = ast_data.get('ast_results', []) if isinstance(ast_data, dict) else []
                    # Count as 1 AST test if there are any results with interpretation
                    if any(r.get('interpretation') for r in ast_results if isinstance(r, dict)):
                        test_count += 1
        
        for start, end in intervals:
            # Calculate sample count for this period
            if dept.code == 'MIC':
                # For microbiology: samples = count of MIC units (1 per MIC code)
                if period_label == 'day':
                    count = db.query(func.count(Unit.id)).filter(
                        and_(
                            Unit.department_id == dept.id,
                            Unit.created_at >= start,
                            Unit.created_at < end
                        )
                    ).scalar() or 0
                else:
                    count = db.query(func.count(Unit.id)).join(
                        Sample, Sample.id == Unit.sample_id
                    ).filter(
                        and_(
                            Unit.department_id == dept.id,
                            Sample.date_received >= start.date(),
                            Sample.date_received < end.date()
                        )
                    ).scalar() or 0
                # For microbiology: sub-samples = sum of samples_number
                if period_label == 'day':
                    period_sub_sample_count = db.query(func.sum(Unit.samples_number)).filter(
                        and_(
                            Unit.department_id == dept.id,
                            Unit.created_at >= start,
                            Unit.created_at < end
                        )
                    ).scalar() or 0
                else:
                    period_sub_sample_count = db.query(func.sum(Unit.samples_number)).join(
                        Sample, Sample.id == Unit.sample_id
                    ).filter(
                        and_(
                            Unit.department_id == dept.id,
                            Sample.date_received >= start.date(),
                            Sample.date_received < end.date()
                        )
                    ).scalar() or 0
            elif dept.code == 'PCR':
                # For PCR: samples = count of PCR units (1 per PCR code)
                if period_label == 'day':
                    count = db.query(func.count(Unit.id)).filter(
                        and_(
                            Unit.department_id == dept.id,
                            Unit.created_at >= start,
                            Unit.created_at < end
                        )
                    ).scalar() or 0
                else:
                    count = db.query(func.count(Unit.id)).join(
                        Sample, Sample.id == Unit.sample_id
                    ).filter(
                        and_(
                            Unit.department_id == dept.id,
                            Sample.date_received >= start.date(),
                            Sample.date_received < end.date()
                        )
                    ).scalar() or 0
                # For PCR: sub-samples = sum of extraction values
                if period_label == 'day':
                    period_sub_sample_count = db.query(func.sum(PCRData.extraction)).join(
                        Unit, Unit.id == PCRData.unit_id
                    ).filter(
                        and_(
                            Unit.department_id == dept.id,
                            Unit.created_at >= start,
                            Unit.created_at < end
                        )
                    ).scalar() or 0
                else:
                    period_sub_sample_count = db.query(func.sum(PCRData.extraction)).join(
                        Unit, Unit.id == PCRData.unit_id
                    ).join(
                        Sample, Sample.id == Unit.sample_id
                    ).filter(
                        and_(
                            Unit.department_id == dept.id,
                            Sample.date_received >= start.date(),
                            Sample.date_received < end.date()
                        )
                    ).scalar() or 0
            else:
                # For other departments (Serology): samples = sum of samples_number
                if period_label == 'day':
                    count = db.query(func.sum(Unit.samples_number)).filter(
                        and_(
                            Unit.department_id == dept.id,
                            Unit.created_at >= start,
                            Unit.created_at < end
                        )
                    ).scalar() or 0
                else:
                    count = db.query(func.sum(Unit.samples_number)).join(
                        Sample, Sample.id == Unit.sample_id
                    ).filter(
                        and_(
                            Unit.department_id == dept.id,
                            Sample.date_received >= start.date(),
                            Sample.date_received < end.date()
                        )
                    ).scalar() or 0
                # For other departments: sub-samples = 0
                period_sub_sample_count = 0
            
            # Calculate test count for this period (PCR, Serology, and Microbiology)
            test_period_count = 0
            if dept.code == 'PCR':
                if period_label == 'day':
                    test_period_count = db.query(func.sum(PCRData.detection)).join(
                        Unit, Unit.id == PCRData.unit_id
                    ).filter(
                        and_(
                            Unit.department_id == dept.id,
                            Unit.created_at >= start,
                            Unit.created_at < end
                        )
                    ).scalar() or 0
                else:
                    test_period_count = db.query(func.sum(PCRData.detection)).join(
                        Unit, Unit.id == PCRData.unit_id
                    ).join(
                        Sample, Sample.id == Unit.sample_id
                    ).filter(
                        and_(
                            Unit.department_id == dept.id,
                            Sample.date_received >= start.date(),
                            Sample.date_received < end.date()
                        )
                    ).scalar() or 0
            elif dept.code == 'SER':
                if period_label == 'day':
                    test_period_count = db.query(func.sum(SerologyData.tests_count)).join(
                        Unit, Unit.id == SerologyData.unit_id
                    ).filter(
                        and_(
                            Unit.department_id == dept.id,
                            Unit.created_at >= start,
                            Unit.created_at < end
                        )
                    ).scalar() or 0
                else:
                    test_period_count = db.query(func.sum(SerologyData.tests_count)).join(
                        Unit, Unit.id == SerologyData.unit_id
                    ).join(
                        Sample, Sample.id == Unit.sample_id
                    ).filter(
                        and_(
                            Unit.department_id == dept.id,
                            Sample.date_received >= start.date(),
                            Sample.date_received < end.date()
                        )
                    ).scalar() or 0
            elif dept.code == 'MIC':
                # For microbiology: tests = sum of visible indexes per disease (excluding hidden indexes)
                if period_label == 'day':
                    mic_units_period = db.query(Unit).join(
                        MicrobiologyData, Unit.id == MicrobiologyData.unit_id
                    ).outerjoin(
                        MicrobiologyCOA, Unit.id == MicrobiologyCOA.unit_id
                    ).filter(
                        and_(
                            Unit.department_id == dept.id,
                            Unit.created_at >= start,
                            Unit.created_at < end
                        )
                    ).all()
                else:
                    mic_units_period = db.query(Unit).join(
                        MicrobiologyData, Unit.id == MicrobiologyData.unit_id
                    ).outerjoin(
                        MicrobiologyCOA, Unit.id == MicrobiologyCOA.unit_id
                    ).join(
                        Sample, Sample.id == Unit.sample_id
                    ).filter(
                        and_(
                            Unit.department_id == dept.id,
                            Sample.date_received >= start.date(),
                            Sample.date_received < end.date()
                        )
                    ).all()
                
                test_period_count = 0
                for unit in mic_units_period:
                    diseases_list = unit.microbiology_data.diseases_list or []
                    index_list = unit.microbiology_data.index_list or []
                    hidden_indexes = unit.microbiology_coa.hidden_indexes if unit.microbiology_coa else {}
                    
                    for disease in diseases_list:
                        disease_hidden = hidden_indexes.get(disease, []) if hidden_indexes else []
                        visible_count = len(index_list) - len(disease_hidden)
                        test_period_count += max(0, visible_count)
                    
                    # Count AST tests if ast_data is present and has results with interpretation
                    if unit.microbiology_coa and unit.microbiology_coa.ast_data:
                        ast_data = unit.microbiology_coa.ast_data
                        ast_results = ast_data.get('ast_results', []) if isinstance(ast_data, dict) else []
                        if any(r.get('interpretation') for r in ast_results if isinstance(r, dict)):
                            test_period_count += 1
            
            data.append(StatisticPoint(
                date=start.isoformat(),
                count=count,
                test_count=test_period_count,
                label=format_label(start)
            ))
            dept_total += count
        
        department_stats.append(DepartmentStatistic(
            department_id=int(dept.id) if dept.id else 0,
            department_name=str(dept.name) if dept.name else "",
            department_code=str(dept.code) if dept.code else "",
            data=data,
            sample_count=sample_count,
            sub_sample_count=sub_sample_count,
            test_count=test_count,
            wells_count=wells_count
        ))
        total += dept_total
    
    return UnitsStatisticsResponse(
        period=period_label,
        departments=department_stats,
        total=total
    )
