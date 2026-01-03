-- Gap-free sample code generation functions

-- Function to get next available sample number (finds gaps)
CREATE OR REPLACE FUNCTION get_next_sample_number(p_year INTEGER)
RETURNS INTEGER AS $$
DECLARE
    v_next_num INTEGER;
BEGIN
    WITH all_nums AS (
        SELECT CAST(SPLIT_PART(sample_code, '-', 2) AS INTEGER) as num
        FROM samples
        WHERE year = p_year AND sample_code LIKE 'SMP%'
        UNION
        SELECT CAST(SPLIT_PART(code, '-', 2) AS INTEGER) as num
        FROM reserved_codes
        WHERE code_type = 'sample' 
          AND year = p_year 
          AND expires_at > NOW()
    ),
    gaps AS (
        SELECT 1 as gap_num 
        WHERE NOT EXISTS (SELECT 1 FROM all_nums WHERE num = 1)
        UNION ALL
        SELECT num + 1 
        FROM all_nums n 
        WHERE NOT EXISTS (SELECT 1 FROM all_nums WHERE num = n.num + 1)
          AND num < (SELECT COALESCE(MAX(num), 0) FROM all_nums)
        UNION ALL
        SELECT COALESCE(MAX(num), 0) + 1 FROM all_nums
    )
    SELECT MIN(gap_num) INTO v_next_num FROM gaps;
    
    RETURN COALESCE(v_next_num, 1);
END;
$$ LANGUAGE plpgsql;

-- Function to reserve a sample code
CREATE OR REPLACE FUNCTION reserve_sample_code(p_year INTEGER, p_session_id TEXT DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
    v_next_num INTEGER;
    v_code TEXT;
    v_year_short TEXT;
BEGIN
    v_year_short := LPAD((p_year % 100)::TEXT, 2, '0');
    
    -- Get next available number
    v_next_num := get_next_sample_number(p_year);
    v_code := 'SMP' || v_year_short || '-' || v_next_num;
    
    -- Reserve the code (expires in 5 minutes)
    INSERT INTO reserved_codes (code_type, code, year, reserved_at, expires_at, session_id)
    VALUES ('sample', v_code, p_year, NOW(), NOW() + INTERVAL '5 minutes', p_session_id)
    ON CONFLICT (code) DO NOTHING;
    
    -- If insert failed due to conflict, recursively try next
    IF NOT FOUND THEN
        RETURN reserve_sample_code(p_year, p_session_id);
    END IF;
    
    RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- Function to confirm a reserved code (called after successful insert)
CREATE OR REPLACE FUNCTION confirm_sample_code(p_code TEXT)
RETURNS VOID AS $$
BEGIN
    DELETE FROM reserved_codes WHERE code = p_code;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup expired reservations
CREATE OR REPLACE FUNCTION cleanup_expired_reservations()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    DELETE FROM reserved_codes WHERE expires_at < NOW();
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get next unit number for a department
CREATE OR REPLACE FUNCTION get_next_unit_number(p_dept_id INTEGER, p_year INTEGER)
RETURNS INTEGER AS $$
DECLARE
    v_next_num INTEGER;
    v_dept_code TEXT;
    v_year_short TEXT;
    v_pattern TEXT;
BEGIN
    SELECT code INTO v_dept_code FROM departments WHERE id = p_dept_id;
    IF v_dept_code IS NULL THEN
        RETURN 1;
    END IF;
    
    v_year_short := LPAD((p_year % 100)::TEXT, 2, '0');
    v_pattern := v_dept_code || v_year_short || '-%';
    
    WITH all_nums AS (
        SELECT CAST(SPLIT_PART(unit_code, '-', 2) AS INTEGER) as num
        FROM units
        WHERE department_id = p_dept_id 
          AND unit_code LIKE v_pattern
        UNION
        SELECT CAST(SPLIT_PART(code, '-', 2) AS INTEGER) as num
        FROM reserved_codes
        WHERE code_type = 'unit' 
          AND department_id = p_dept_id
          AND year = p_year 
          AND expires_at > NOW()
    ),
    gaps AS (
        SELECT 1 as gap_num 
        WHERE NOT EXISTS (SELECT 1 FROM all_nums WHERE num = 1)
        UNION ALL
        SELECT num + 1 
        FROM all_nums n 
        WHERE NOT EXISTS (SELECT 1 FROM all_nums WHERE num = n.num + 1)
          AND num < (SELECT COALESCE(MAX(num), 0) FROM all_nums)
        UNION ALL
        SELECT COALESCE(MAX(num), 0) + 1 FROM all_nums
    )
    SELECT MIN(gap_num) INTO v_next_num FROM gaps;
    
    RETURN COALESCE(v_next_num, 1);
END;
$$ LANGUAGE plpgsql;

-- Function to reserve a unit code
CREATE OR REPLACE FUNCTION reserve_unit_code(p_dept_id INTEGER, p_year INTEGER, p_session_id TEXT DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
    v_next_num INTEGER;
    v_code TEXT;
    v_dept_code TEXT;
    v_year_short TEXT;
BEGIN
    SELECT code INTO v_dept_code FROM departments WHERE id = p_dept_id;
    IF v_dept_code IS NULL THEN
        RETURN NULL;
    END IF;
    
    v_year_short := LPAD((p_year % 100)::TEXT, 2, '0');
    
    v_next_num := get_next_unit_number(p_dept_id, p_year);
    v_code := v_dept_code || v_year_short || '-' || v_next_num;
    
    INSERT INTO reserved_codes (code_type, code, year, department_id, reserved_at, expires_at, session_id)
    VALUES ('unit', v_code, p_year, p_dept_id, NOW(), NOW() + INTERVAL '5 minutes', p_session_id)
    ON CONFLICT (code) DO NOTHING;
    
    IF NOT FOUND THEN
        RETURN reserve_unit_code(p_dept_id, p_year, p_session_id);
    END IF;
    
    RETURN v_code;
END;
$$ LANGUAGE plpgsql;
