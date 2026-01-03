-- =====================================================
-- POULTRY LIMS v1.2 - Complete Database Schema Fix
-- Run this script to add ALL missing columns at once
-- =====================================================

-- =====================================================
-- USERS TABLE
-- =====================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture VARCHAR;

-- =====================================================
-- SAMPLES TABLE
-- =====================================================
ALTER TABLE samples ADD COLUMN IF NOT EXISTS last_edited_by VARCHAR(255);

-- =====================================================
-- UNITS TABLE
-- =====================================================
ALTER TABLE units ADD COLUMN IF NOT EXISTS house JSON;
ALTER TABLE units ADD COLUMN IF NOT EXISTS age VARCHAR(50);
ALTER TABLE units ADD COLUMN IF NOT EXISTS source JSON;
ALTER TABLE units ADD COLUMN IF NOT EXISTS sample_type JSON;
ALTER TABLE units ADD COLUMN IF NOT EXISTS samples_number INTEGER;
ALTER TABLE units ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS coa_status VARCHAR(50);
ALTER TABLE units ADD COLUMN IF NOT EXISTS created_at TIMESTAMP;
ALTER TABLE units ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;
ALTER TABLE units ADD COLUMN IF NOT EXISTS last_edited_by VARCHAR(255);

-- =====================================================
-- SEROLOGY DATA TABLE
-- =====================================================
ALTER TABLE serology_data ADD COLUMN IF NOT EXISTS diseases_list JSON;
ALTER TABLE serology_data ADD COLUMN IF NOT EXISTS kit_type VARCHAR(255);
ALTER TABLE serology_data ADD COLUMN IF NOT EXISTS number_of_wells INTEGER;
ALTER TABLE serology_data ADD COLUMN IF NOT EXISTS tests_count INTEGER;
ALTER TABLE serology_data ADD COLUMN IF NOT EXISTS technician_name VARCHAR(255);
ALTER TABLE serology_data ADD COLUMN IF NOT EXISTS created_at TIMESTAMP;
ALTER TABLE serology_data ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

-- =====================================================
-- PCR DATA TABLE
-- =====================================================
ALTER TABLE pcr_data ADD COLUMN IF NOT EXISTS diseases_list JSON;
ALTER TABLE pcr_data ADD COLUMN IF NOT EXISTS technician_name VARCHAR(255);
ALTER TABLE pcr_data ADD COLUMN IF NOT EXISTS extraction_method VARCHAR(255);
ALTER TABLE pcr_data ADD COLUMN IF NOT EXISTS extraction INTEGER;
ALTER TABLE pcr_data ADD COLUMN IF NOT EXISTS detection INTEGER;
ALTER TABLE pcr_data ADD COLUMN IF NOT EXISTS created_at TIMESTAMP;
ALTER TABLE pcr_data ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

-- =====================================================
-- MICROBIOLOGY DATA TABLE
-- =====================================================
ALTER TABLE microbiology_data ADD COLUMN IF NOT EXISTS diseases_list JSON;
ALTER TABLE microbiology_data ADD COLUMN IF NOT EXISTS batch_no VARCHAR(100);
ALTER TABLE microbiology_data ADD COLUMN IF NOT EXISTS fumigation VARCHAR(50);
ALTER TABLE microbiology_data ADD COLUMN IF NOT EXISTS index_list JSON;
ALTER TABLE microbiology_data ADD COLUMN IF NOT EXISTS technician_name VARCHAR(255);
ALTER TABLE microbiology_data ADD COLUMN IF NOT EXISTS created_at TIMESTAMP;
ALTER TABLE microbiology_data ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

-- =====================================================
-- MICROBIOLOGY COA TABLE
-- =====================================================
ALTER TABLE microbiology_coas ADD COLUMN IF NOT EXISTS test_results JSON;
ALTER TABLE microbiology_coas ADD COLUMN IF NOT EXISTS test_portions JSON;
ALTER TABLE microbiology_coas ADD COLUMN IF NOT EXISTS test_report_numbers JSON;
ALTER TABLE microbiology_coas ADD COLUMN IF NOT EXISTS test_methods JSON;
ALTER TABLE microbiology_coas ADD COLUMN IF NOT EXISTS isolate_types JSON;
ALTER TABLE microbiology_coas ADD COLUMN IF NOT EXISTS test_ranges JSON;
ALTER TABLE microbiology_coas ADD COLUMN IF NOT EXISTS hidden_indexes JSON;
ALTER TABLE microbiology_coas ADD COLUMN IF NOT EXISTS ast_data JSON;
ALTER TABLE microbiology_coas ADD COLUMN IF NOT EXISTS date_tested DATE;
ALTER TABLE microbiology_coas ADD COLUMN IF NOT EXISTS tested_by VARCHAR(255);
ALTER TABLE microbiology_coas ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(255);
ALTER TABLE microbiology_coas ADD COLUMN IF NOT EXISTS lab_supervisor VARCHAR(255);
ALTER TABLE microbiology_coas ADD COLUMN IF NOT EXISTS lab_manager VARCHAR(255);
ALTER TABLE microbiology_coas ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE microbiology_coas ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'draft';
ALTER TABLE microbiology_coas ADD COLUMN IF NOT EXISTS created_at TIMESTAMP;
ALTER TABLE microbiology_coas ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

-- =====================================================
-- PCR COA TABLE
-- =====================================================
ALTER TABLE pcr_coa ADD COLUMN IF NOT EXISTS test_results JSON;
ALTER TABLE pcr_coa ADD COLUMN IF NOT EXISTS date_tested DATE;
ALTER TABLE pcr_coa ADD COLUMN IF NOT EXISTS tested_by VARCHAR(255);
ALTER TABLE pcr_coa ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(255);
ALTER TABLE pcr_coa ADD COLUMN IF NOT EXISTS lab_supervisor VARCHAR(255);
ALTER TABLE pcr_coa ADD COLUMN IF NOT EXISTS lab_manager VARCHAR(255);
ALTER TABLE pcr_coa ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE pcr_coa ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'draft';
ALTER TABLE pcr_coa ADD COLUMN IF NOT EXISTS created_at TIMESTAMP;
ALTER TABLE pcr_coa ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

-- =====================================================
-- SEROLOGY COA TABLE
-- =====================================================
ALTER TABLE serology_coas ADD COLUMN IF NOT EXISTS test_results JSON;
ALTER TABLE serology_coas ADD COLUMN IF NOT EXISTS well_data JSON;
ALTER TABLE serology_coas ADD COLUMN IF NOT EXISTS test_report_numbers JSON;
ALTER TABLE serology_coas ADD COLUMN IF NOT EXISTS test_methods JSON;
ALTER TABLE serology_coas ADD COLUMN IF NOT EXISTS kit_types JSON;
ALTER TABLE serology_coas ADD COLUMN IF NOT EXISTS date_tested DATE;
ALTER TABLE serology_coas ADD COLUMN IF NOT EXISTS tested_by VARCHAR(255);
ALTER TABLE serology_coas ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(255);
ALTER TABLE serology_coas ADD COLUMN IF NOT EXISTS lab_supervisor VARCHAR(255);
ALTER TABLE serology_coas ADD COLUMN IF NOT EXISTS lab_manager VARCHAR(255);
ALTER TABLE serology_coas ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE serology_coas ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'draft';
ALTER TABLE serology_coas ADD COLUMN IF NOT EXISTS created_at TIMESTAMP;
ALTER TABLE serology_coas ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

-- =====================================================
-- SIGNATURES TABLE
-- =====================================================
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS signature_image VARCHAR;
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- =====================================================
-- FARMS TABLE (fix company_id relationship)
-- =====================================================
ALTER TABLE farms ADD COLUMN IF NOT EXISTS company_id INTEGER;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Fix farms unique constraint (allow same farm name for different companies)
DROP INDEX IF EXISTS ix_farms_name;

-- =====================================================
-- OTHER CONTROL TABLES - Ensure is_active column exists
-- =====================================================
ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE flocks ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE cycles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE statuses ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE houses ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE sample_types ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE diseases ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE kit_types ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE technicians ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE extraction_methods ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE culture_isolation_types ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE pathogenic_fungi_mold ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE culture_screened_pathogens ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- =====================================================
-- AST DISK TABLES
-- =====================================================
ALTER TABLE ast_disks ADD COLUMN IF NOT EXISTS r_value VARCHAR;
ALTER TABLE ast_disks ADD COLUMN IF NOT EXISTS i_value VARCHAR;
ALTER TABLE ast_disks ADD COLUMN IF NOT EXISTS s_value VARCHAR;
ALTER TABLE ast_disks ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

ALTER TABLE ast_disks_fastidious ADD COLUMN IF NOT EXISTS r_value VARCHAR;
ALTER TABLE ast_disks_fastidious ADD COLUMN IF NOT EXISTS i_value VARCHAR;
ALTER TABLE ast_disks_fastidious ADD COLUMN IF NOT EXISTS s_value VARCHAR;
ALTER TABLE ast_disks_fastidious ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

ALTER TABLE ast_disks_staphylococcus ADD COLUMN IF NOT EXISTS r_value VARCHAR;
ALTER TABLE ast_disks_staphylococcus ADD COLUMN IF NOT EXISTS i_value VARCHAR;
ALTER TABLE ast_disks_staphylococcus ADD COLUMN IF NOT EXISTS s_value VARCHAR;
ALTER TABLE ast_disks_staphylococcus ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

ALTER TABLE ast_disks_enterococcus ADD COLUMN IF NOT EXISTS r_value VARCHAR;
ALTER TABLE ast_disks_enterococcus ADD COLUMN IF NOT EXISTS i_value VARCHAR;
ALTER TABLE ast_disks_enterococcus ADD COLUMN IF NOT EXISTS s_value VARCHAR;
ALTER TABLE ast_disks_enterococcus ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- =====================================================
-- Done! All columns should now be present.
-- =====================================================
