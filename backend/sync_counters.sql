-- Sync counters with actual data in the database
-- Run this script to fix counter desync issues

-- Step 1: Find the highest sample number for each year and update the counter
DO $$
DECLARE
    max_sample_num INTEGER;
    year_val INTEGER;
    counter_exists BOOLEAN;
BEGIN
    -- Get all years with samples
    FOR year_val IN SELECT DISTINCT year FROM samples ORDER BY year
    LOOP
        -- Find the highest sample number for this year
        SELECT COALESCE(MAX(
            CAST(SPLIT_PART(sample_code, '-', 2) AS INTEGER)
        ), 0)
        INTO max_sample_num
        FROM samples
        WHERE year = year_val
        AND sample_code LIKE 'SMP%-%';
        
        -- Check if counter exists for this year
        SELECT EXISTS(
            SELECT 1 FROM counters 
            WHERE counter_type = 'sample' 
            AND department_id IS NULL 
            AND year = year_val
        ) INTO counter_exists;
        
        IF counter_exists THEN
            -- Update existing counter
            UPDATE counters 
            SET current_value = max_sample_num
            WHERE counter_type = 'sample' 
            AND department_id IS NULL 
            AND year = year_val;
            RAISE NOTICE 'Updated sample counter for year % to %', year_val, max_sample_num;
        ELSE
            -- Insert new counter
            INSERT INTO counters (counter_type, department_id, year, current_value)
            VALUES ('sample', NULL, year_val, max_sample_num);
            RAISE NOTICE 'Created sample counter for year % with value %', year_val, max_sample_num;
        END IF;
    END LOOP;
END $$;

-- Step 2: Find the highest unit number for each department and year, then update counters
DO $$
DECLARE
    max_unit_num INTEGER;
    dept_id INTEGER;
    dept_code VARCHAR;
    year_val INTEGER;
    counter_exists BOOLEAN;
BEGIN
    -- Get all departments
    FOR dept_id, dept_code IN SELECT id, code FROM departments
    LOOP
        -- Get all years that have units for this department
        FOR year_val IN 
            SELECT DISTINCT CAST(SPLIT_PART(unit_code, '-', 2) AS INTEGER) + 2000 as yr
            FROM units 
            WHERE department_id = dept_id 
            AND unit_code LIKE dept_code || '-%'
            ORDER BY yr
        LOOP
            -- Find the highest unit number for this department and year
            SELECT COALESCE(MAX(
                CAST(SPLIT_PART(unit_code, '-', 3) AS INTEGER)
            ), 0)
            INTO max_unit_num
            FROM units
            WHERE department_id = dept_id
            AND unit_code LIKE dept_code || '-' || LPAD(CAST((year_val % 100) AS VARCHAR), 2, '0') || '-%';
            
            -- Check if counter exists
            SELECT EXISTS(
                SELECT 1 FROM counters 
                WHERE counter_type = 'unit' 
                AND department_id = dept_id 
                AND year = year_val
            ) INTO counter_exists;
            
            IF counter_exists THEN
                -- Update existing counter
                UPDATE counters 
                SET current_value = max_unit_num
                WHERE counter_type = 'unit' 
                AND department_id = dept_id 
                AND year = year_val;
                RAISE NOTICE 'Updated unit counter for dept % year % to %', dept_code, year_val, max_unit_num;
            ELSE
                -- Insert new counter
                INSERT INTO counters (counter_type, department_id, year, current_value)
                VALUES ('unit', dept_id, year_val, max_unit_num);
                RAISE NOTICE 'Created unit counter for dept % year % with value %', dept_code, year_val, max_unit_num;
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- Step 3: Display current counter values after sync
SELECT 
    c.counter_type,
    c.year,
    d.code as department_code,
    c.current_value
FROM counters c
LEFT JOIN departments d ON c.department_id = d.id
ORDER BY c.counter_type, c.year, d.code;
